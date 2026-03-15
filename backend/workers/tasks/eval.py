"""Eval experiment runner — Celery task.

Flow:
  1. Load experiment from DB, mark → running
  2. Load QA dataset from evals/datasets/<dataset_file>
  3. For each QA pair:
     a. Embed the question (skipped for bm25-only strategy)
     b. Retrieve top-k chunks using the experiment's strategy + config
     c. Generate answer via ClaudeClient.complete() (haiku, non-streaming)
     d. Score faithfulness, relevance, recall
     e. Write EvalResult row
  4. Compute aggregate metrics → write to Experiment.results, mark → complete

  On any error → rollback open session, open fresh session, mark → failed
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from celery import Task

from backend.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# Project root is 4 levels up from this file.
DATASETS_DIR = Path(__file__).parents[4] / "evals" / "datasets"


@celery_app.task(
    bind=True,
    name="backend.workers.tasks.eval.run_eval_experiment",
    max_retries=0,
    time_limit=3600,       # Hard kill after 60 minutes — evals can be lengthy
    soft_time_limit=3300,  # SIGTERM after 55 minutes for graceful shutdown
)
def run_eval_experiment(self: Task, experiment_id: str) -> dict[str, object]:
    """Synchronous Celery entry point — delegates to async pipeline."""
    return asyncio.run(_async_eval_pipeline(experiment_id))


async def _async_eval_pipeline(experiment_id: str) -> dict[str, object]:
    # All imports are lazy to avoid loading the full application graph at
    # Celery worker startup (task discovery time).
    from backend.models.database import async_session_factory
    from backend.models.tables.experiments import (
        EvalResult,
        Experiment,
        ExperimentStatus,
    )
    from backend.services.evaluation.metrics import (
        score_faithfulness,
        score_recall,
        score_relevance,
    )
    from backend.services.generation.claude import ClaudeClient, ClaudeModel
    from backend.services.generation.prompts import RAG_QA_V1

    exp_uuid = uuid.UUID(experiment_id)

    async with async_session_factory() as session:
        try:
            # ------------------------------------------------------------------
            # Step 1: Load experiment and mark as running
            # ------------------------------------------------------------------
            exp = await session.get(Experiment, exp_uuid)
            if exp is None:
                raise ValueError(f"Experiment {experiment_id} not found")

            exp.status = ExperimentStatus.running
            await session.commit()
            logger.info("Eval started: experiment=%s", experiment_id)

            # ------------------------------------------------------------------
            # Step 2: Load QA dataset from disk
            # ------------------------------------------------------------------
            dataset_file: str | None = exp.config.get("dataset_file")
            if not dataset_file:
                raise ValueError("Experiment config missing 'dataset_file'")

            dataset_path = DATASETS_DIR / dataset_file
            if not dataset_path.exists():
                raise FileNotFoundError(f"Dataset file not found: {dataset_path}")

            dataset = json.loads(dataset_path.read_text())
            pairs: list[dict] = dataset["pairs"]
            logger.info("Loaded %d QA pairs from %s", len(pairs), dataset_file)

            # ------------------------------------------------------------------
            # Step 3: Resolve retrieval config from experiment
            # ------------------------------------------------------------------
            retrieval_strategy: str = exp.retrieval_strategy
            top_k: int = exp.config.get("top_k", 5)
            raw_doc_ids: list[str] | None = exp.config.get("document_ids")
            document_ids: list[uuid.UUID] | None = (
                [uuid.UUID(d) for d in raw_doc_ids] if raw_doc_ids else None
            )

            claude = ClaudeClient()

            # ------------------------------------------------------------------
            # Step 4: Run retrieval → generation → scoring for each QA pair
            # ------------------------------------------------------------------
            faithfulness_scores: list[float] = []
            relevance_scores: list[float] = []
            recall_scores: list[float] = []

            for pair in pairs:
                question: str = pair["question"]
                expected_answer: str = pair["expected_answer"]
                source_chunk_id: str = pair["source_chunk_id"]

                # Embed query for vector-based strategies
                query_vector: list[float] | None = None
                if retrieval_strategy in ("vector", "hybrid"):
                    from backend.services.ingestion.embedder import VoyageQueryEmbedder
                    embedder = VoyageQueryEmbedder()
                    vectors = await embedder.embed([question])
                    query_vector = vectors[0]

                # Retrieve top-k chunks
                chunks = await _retrieve(
                    strategy=retrieval_strategy,
                    session=session,
                    query=question,
                    query_vector=query_vector,
                    top_k=top_k,
                    document_ids=document_ids,
                )

                retrieved_chunk_ids = [str(c.chunk_id) for c in chunks]

                # Generate non-streaming answer (haiku, eval context)
                user_message = RAG_QA_V1.render_user_message(chunks, question)
                generated_answer = await claude.complete(
                    messages=[{"role": "user", "content": user_message}],
                    system=RAG_QA_V1.system_prompt,
                    model=ClaudeModel.haiku,
                )

                # Score
                context_texts = [c.content for c in chunks]
                faithfulness = await score_faithfulness(context_texts, generated_answer)
                relevance = await score_relevance(question, generated_answer)
                recall = score_recall(source_chunk_id, retrieved_chunk_ids)

                faithfulness_scores.append(faithfulness)
                relevance_scores.append(relevance)
                recall_scores.append(recall)

                result_row = EvalResult(
                    experiment_id=exp_uuid,
                    source_chunk_id=(
                        uuid.UUID(source_chunk_id) if source_chunk_id else None
                    ),
                    question=question,
                    expected_answer=expected_answer,
                    retrieved_chunks={
                        "chunk_ids": retrieved_chunk_ids,
                        "scores": [c.score for c in chunks],
                    },
                    generated_answer=generated_answer,
                    faithfulness_score=faithfulness,
                    relevance_score=relevance,
                    recall_score=recall,
                )
                session.add(result_row)
                await session.flush()

                logger.debug(
                    "Scored: faithfulness=%.2f relevance=%.2f recall=%.2f",
                    faithfulness,
                    relevance,
                    recall,
                )

            # ------------------------------------------------------------------
            # Step 5: Aggregate and mark complete
            # ------------------------------------------------------------------
            n = len(pairs)

            def _avg(scores: list[float]) -> float:
                return sum(scores) / n if n > 0 else 0.0

            exp.results = {
                "total_questions": n,
                "avg_faithfulness": _avg(faithfulness_scores),
                "avg_relevance": _avg(relevance_scores),
                "avg_recall": _avg(recall_scores),
            }
            exp.status = ExperimentStatus.complete
            exp.completed_at = datetime.now(timezone.utc)
            await session.commit()

            logger.info(
                "Eval complete: experiment=%s faithfulness=%.3f relevance=%.3f recall=%.3f",
                experiment_id,
                exp.results["avg_faithfulness"],
                exp.results["avg_relevance"],
                exp.results["avg_recall"],
            )
            return {"status": "complete", "experiment_id": experiment_id}

        except Exception as exc:
            await session.rollback()
            logger.exception("Eval failed for experiment %s", experiment_id)
            await _mark_experiment_failed(exp_uuid, exc)
            raise  # Re-raise so Celery records the task as FAILURE


async def _retrieve(
    strategy: str,
    session: object,
    query: str,
    query_vector: list[float] | None,
    top_k: int,
    document_ids: list[uuid.UUID] | None,
) -> list:
    """Dispatch to the correct retriever based on strategy name."""
    if strategy == "vector":
        from backend.services.retrieval.vector import VectorRetriever
        assert query_vector is not None
        return await VectorRetriever().search(
            session,
            query_vector=query_vector,
            top_k=top_k,
            document_ids=document_ids,
        )
    elif strategy == "bm25":
        from backend.services.retrieval.bm25 import BM25Retriever
        return await BM25Retriever().search(
            session,
            query=query,
            top_k=top_k,
            document_ids=document_ids,
        )
    elif strategy == "hybrid":
        from backend.services.retrieval.hybrid import HybridRetriever
        assert query_vector is not None
        return await HybridRetriever().search(
            session,
            query=query,
            query_vector=query_vector,
            top_k=top_k,
            document_ids=document_ids,
        )
    else:
        raise ValueError(f"Unknown retrieval strategy: {strategy!r}")


async def _mark_experiment_failed(exp_uuid: uuid.UUID, exc: Exception) -> None:
    """Open a fresh session to persist the failed status.

    The session from the main pipeline has already been rolled back and is
    not safe to reuse — this mirrors the pattern from the ingestion task.
    """
    from backend.models.database import async_session_factory
    from backend.models.tables.experiments import Experiment, ExperimentStatus

    try:
        async with async_session_factory() as session:
            exp = await session.get(Experiment, exp_uuid)
            if exp is not None:
                exp.status = ExperimentStatus.failed
                await session.commit()
    except Exception:
        logger.exception(
            "Failed to persist error status for experiment %s", exp_uuid
        )
