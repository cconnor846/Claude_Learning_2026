"""Synthetic QA pair generation from document chunks.

Uses Claude haiku to generate factual question-answer pairs grounded in
a specific chunk. Each pair records the source chunk ID so that recall
scoring can check whether the ground-truth chunk is retrieved.

Generated datasets are saved to evals/datasets/ as JSON files. The
filename is returned and stored in the Experiment.config so the eval
task knows where to load the dataset from.
"""

import json
import logging
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from backend.services.generation.claude import ClaudeClient, ClaudeModel

logger = logging.getLogger(__name__)

# Path is relative to the project root (4 levels up from this file).
DATASETS_DIR = Path(__file__).parents[4] / "evals" / "datasets"

_SYSTEM_PROMPT = (
    "You are an expert at creating evaluation datasets for RAG systems. "
    "Given a text passage, generate one factual question and a concise answer "
    "that is directly and completely supported by the passage. "
    "The answer must be answerable from the passage alone — no outside knowledge.\n\n"
    "Respond with valid JSON and nothing else, in this exact format:\n"
    '{"question": "<the question>", "answer": "<the answer>"}'
)


@dataclass
class SyntheticQAPair:
    question: str
    expected_answer: str
    source_chunk_id: str
    source_document_id: str


class SyntheticGenerator:
    def __init__(self) -> None:
        self._client = ClaudeClient()

    async def generate(
        self,
        chunks: list[dict[str, str]],
        n_per_chunk: int = 1,
    ) -> list[SyntheticQAPair]:
        """Generate QA pairs from a list of chunk dicts.

        Args:
            chunks: Each dict must have keys: chunk_id, document_id, content.
            n_per_chunk: Number of QA pairs to attempt per chunk.

        Returns:
            List of successfully generated SyntheticQAPairs. Chunks that
            fail to produce a parseable response are skipped with a warning.
        """
        pairs: list[SyntheticQAPair] = []
        for chunk in chunks:
            for _ in range(n_per_chunk):
                try:
                    pair = await self._generate_one(chunk)
                    if pair is not None:
                        pairs.append(pair)
                except Exception:
                    logger.exception(
                        "QA generation failed for chunk %s", chunk["chunk_id"]
                    )
        return pairs

    async def _generate_one(
        self, chunk: dict[str, str]
    ) -> SyntheticQAPair | None:
        raw = await self._client.complete(
            messages=[{"role": "user", "content": f"Passage:\n\n{chunk['content']}"}],
            system=_SYSTEM_PROMPT,
            model=ClaudeModel.haiku,
            max_tokens=512,
        )
        try:
            data = json.loads(raw.strip())
            question = data["question"].strip()
            answer = data["answer"].strip()
        except (json.JSONDecodeError, KeyError):
            logger.warning(
                "Could not parse QA response for chunk %s: %r",
                chunk["chunk_id"],
                raw[:200],
            )
            return None

        return SyntheticQAPair(
            question=question,
            expected_answer=answer,
            source_chunk_id=chunk["chunk_id"],
            source_document_id=chunk["document_id"],
        )

    async def save_dataset(
        self,
        pairs: list[SyntheticQAPair],
        document_id: str,
    ) -> str:
        """Persist QA pairs to evals/datasets/ as a JSON file.

        Returns:
            The filename (not full path). Store this in Experiment.config
            so the eval task can load it.
        """
        DATASETS_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        filename = f"{document_id}_{timestamp}.json"
        path = DATASETS_DIR / filename
        payload = {
            "document_id": document_id,
            "generated_at": timestamp,
            "pair_count": len(pairs),
            "pairs": [asdict(p) for p in pairs],
        }
        path.write_text(json.dumps(payload, indent=2))
        logger.info("Saved %d QA pairs to %s", len(pairs), filename)
        return filename
