"""Evaluation endpoints.

POST   /api/v1/evals/datasets/generate        — generate synthetic QA pairs from a document
POST   /api/v1/evals/runs                     — create an experiment and enqueue eval task
GET    /api/v1/evals/runs                     — list experiments with status + aggregate results
GET    /api/v1/evals/runs/{experiment_id}     — get experiment detail with all EvalResult rows
"""

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.models.tables.documents import Chunk, Document, DocumentStatus
from backend.models.tables.experiments import (
    EvalResult,
    Experiment,
    ExperimentStatus,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class GenerateDatasetRequest(BaseModel):
    document_id: uuid.UUID
    n_per_chunk: int = Field(1, ge=1, le=5, description="QA pairs to generate per chunk")
    chunk_limit: int = Field(
        20, ge=1, le=200, description="Max number of chunks to sample from the document"
    )


class GenerateDatasetResponse(BaseModel):
    document_id: uuid.UUID
    pair_count: int
    dataset_file: str  # Filename in evals/datasets/ — pass this to POST /runs


class CreateExperimentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    retrieval_strategy: Literal["vector", "bm25", "hybrid"] = "hybrid"
    chunking_strategy: str = Field(..., min_length=1, max_length=127)
    embedding_model: str = Field(..., min_length=1, max_length=127)
    dataset_file: str = Field(
        ..., description="Filename returned by POST /datasets/generate"
    )
    top_k: int = Field(5, ge=1, le=50)
    document_ids: list[uuid.UUID] | None = Field(
        None,
        description="Restrict retrieval to these documents. None = all documents.",
    )


class ExperimentListItem(BaseModel):
    experiment_id: uuid.UUID
    name: str
    description: str | None
    retrieval_strategy: str
    chunking_strategy: str
    embedding_model: str
    status: ExperimentStatus
    results: dict | None
    created_at: datetime
    completed_at: datetime | None


class EvalResultItem(BaseModel):
    result_id: uuid.UUID
    question: str
    expected_answer: str
    generated_answer: str | None
    source_chunk_id: uuid.UUID | None
    faithfulness_score: float | None
    faithfulness_reasoning: str | None
    relevance_score: float | None
    relevance_reasoning: str | None
    recall_score: float | None
    created_at: datetime


class ExperimentDetail(ExperimentListItem):
    config: dict
    eval_results: list[EvalResultItem]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _experiment_to_list_item(exp: Experiment) -> ExperimentListItem:
    return ExperimentListItem(
        experiment_id=exp.id,
        name=exp.name,
        description=exp.description,
        retrieval_strategy=exp.retrieval_strategy,
        chunking_strategy=exp.chunking_strategy,
        embedding_model=exp.embedding_model,
        status=exp.status,
        results=exp.results,
        created_at=exp.created_at,
        completed_at=exp.completed_at,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/datasets/generate",
    response_model=GenerateDatasetResponse,
    summary="Generate synthetic QA pairs from a document's chunks",
)
async def generate_dataset(
    request: GenerateDatasetRequest,
    db: AsyncSession = Depends(get_db),
) -> GenerateDatasetResponse:
    """Use Claude haiku to generate question-answer pairs from a document's chunks.

    The pairs are saved to evals/datasets/ as a JSON file. The returned
    dataset_file value should be passed to POST /runs when creating an
    experiment that uses this dataset.

    Only chunks from documents with status 'ready' are eligible.
    """
    doc = await db.get(Document, request.document_id)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {request.document_id} not found",
        )
    if doc.status != DocumentStatus.ready:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Document is not ready for evaluation (status={doc.status})",
        )

    # Load chunks up to the requested limit, ordered by chunk_index
    chunks_result = await db.execute(
        select(Chunk)
        .where(Chunk.document_id == request.document_id)
        .order_by(Chunk.chunk_index)
        .limit(request.chunk_limit)
    )
    chunks = chunks_result.scalars().all()

    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document has no chunks — ensure ingestion completed successfully",
        )

    chunk_dicts = [
        {
            "chunk_id": str(c.id),
            "document_id": str(request.document_id),
            "content": c.content,
        }
        for c in chunks
    ]

    from backend.services.evaluation.synthetic import SyntheticGenerator

    generator = SyntheticGenerator()
    pairs = await generator.generate(chunk_dicts, n_per_chunk=request.n_per_chunk)
    dataset_file = await generator.save_dataset(pairs, str(request.document_id))

    return GenerateDatasetResponse(
        document_id=request.document_id,
        pair_count=len(pairs),
        dataset_file=dataset_file,
    )


@router.post(
    "/runs",
    response_model=ExperimentListItem,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create an eval experiment and enqueue the eval task",
)
async def create_experiment(
    request: CreateExperimentRequest,
    db: AsyncSession = Depends(get_db),
) -> ExperimentListItem:
    """Create an Experiment record and enqueue the async eval task.

    Returns immediately with 202 Accepted. Poll GET /runs/{id} to check
    progress. When status transitions to 'complete', the results field
    contains aggregate faithfulness, relevance, and recall scores.
    """
    config: dict = {
        "dataset_file": request.dataset_file,
        "top_k": request.top_k,
    }
    if request.document_ids is not None:
        config["document_ids"] = [str(d) for d in request.document_ids]

    exp = Experiment(
        name=request.name,
        description=request.description,
        retrieval_strategy=request.retrieval_strategy,
        chunking_strategy=request.chunking_strategy,
        embedding_model=request.embedding_model,
        status=ExperimentStatus.pending,
        config=config,
    )
    db.add(exp)
    await db.flush()  # Populate exp.id before enqueueing

    from backend.workers.tasks.eval import run_eval_experiment  # lazy import
    run_eval_experiment.delay(str(exp.id))

    return _experiment_to_list_item(exp)


@router.get(
    "/runs",
    response_model=list[ExperimentListItem],
    summary="List eval experiments",
)
async def list_experiments(
    db: AsyncSession = Depends(get_db),
    status_filter: ExperimentStatus | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[ExperimentListItem]:
    """Return a paginated list of experiments ordered by creation date descending."""
    stmt = select(Experiment).order_by(Experiment.created_at.desc())
    if status_filter is not None:
        stmt = stmt.where(Experiment.status == status_filter)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    experiments = result.scalars().all()
    return [_experiment_to_list_item(e) for e in experiments]


@router.get(
    "/runs/{experiment_id}",
    response_model=ExperimentDetail,
    summary="Get experiment detail with all eval results",
)
async def get_experiment(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ExperimentDetail:
    """Return the experiment and all its individual EvalResult rows.

    Use this to inspect per-question scores, retrieved chunks, and generated
    answers after the experiment completes.
    """
    exp = await db.get(Experiment, experiment_id)
    if exp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment {experiment_id} not found",
        )

    results_stmt = (
        select(EvalResult)
        .where(EvalResult.experiment_id == experiment_id)
        .order_by(EvalResult.created_at)
    )
    results_result = await db.execute(results_stmt)
    eval_results = results_result.scalars().all()

    return ExperimentDetail(
        **_experiment_to_list_item(exp).model_dump(),
        config=exp.config,
        eval_results=[
            EvalResultItem(
                result_id=r.id,
                question=r.question,
                expected_answer=r.expected_answer,
                generated_answer=r.generated_answer,
                source_chunk_id=r.source_chunk_id,
                faithfulness_score=r.faithfulness_score,
                faithfulness_reasoning=r.faithfulness_reasoning,
                relevance_score=r.relevance_score,
                relevance_reasoning=r.relevance_reasoning,
                recall_score=r.recall_score,
                created_at=r.created_at,
            )
            for r in eval_results
        ],
    )
