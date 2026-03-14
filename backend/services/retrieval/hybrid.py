"""Hybrid retrieval: vector + BM25 merged with Reciprocal Rank Fusion (RRF).

RRF is a parameter-free score fusion method that is robust to differences in
score scale between the two retrievers. It works by converting each result's
rank into a score using the formula:

    rrf_score(rank) = 1 / (k + rank)    where k=60 is the standard constant.

Results from both retrievers are combined by summing their RRF scores per
chunk_id. The final ranking is by total RRF score descending.

Each retriever is asked for top_k * 3 candidates before merging, giving the
fusion step enough material to produce top_k high-quality final results.

Why RRF over weighted sum?
- No weights to tune — one less hyperparameter to get wrong.
- Robust to score scale differences (BM25 scores are unbounded; cosine
  similarity is bounded to [-1, 1]).
- Competitive with learned fusion methods in retrieval benchmarks.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.retrieval import RetrievedChunk
from backend.services.retrieval.bm25 import BM25Retriever
from backend.services.retrieval.vector import VectorRetriever

_RRF_K = 60  # Standard constant — rarely needs tuning


def _rrf_score(rank: int) -> float:
    """Reciprocal rank score. rank is 0-indexed."""
    return 1.0 / (_RRF_K + rank + 1)


class HybridRetriever:
    def __init__(self) -> None:
        self._vector = VectorRetriever()
        self._bm25 = BM25Retriever()

    async def search(
        self,
        db: AsyncSession,
        query: str,
        query_vector: list[float],
        top_k: int = 10,
        document_ids: list[uuid.UUID] | None = None,
    ) -> list[RetrievedChunk]:
        """Run vector and BM25 retrieval in sequence and merge with RRF.

        Args:
            db: Async SQLAlchemy session.
            query: Raw query string for BM25.
            query_vector: Embedded query for vector search (input_type="query").
            top_k: Number of final results to return.
            document_ids: If provided, restricts both retrievers to these docs.
        """
        candidate_k = top_k * 3

        vector_results = await self._vector.search(
            db, query_vector, top_k=candidate_k, document_ids=document_ids
        )
        bm25_results = await self._bm25.search(
            db, query, top_k=candidate_k, document_ids=document_ids
        )

        # Accumulate RRF scores keyed by chunk_id.
        # We keep the RetrievedChunk object from whichever retriever first
        # surfaces a chunk — both contain the same chunk metadata.
        rrf_scores: dict[uuid.UUID, float] = {}
        chunks_by_id: dict[uuid.UUID, RetrievedChunk] = {}

        for rank, chunk in enumerate(vector_results):
            rrf_scores[chunk.chunk_id] = rrf_scores.get(chunk.chunk_id, 0.0) + _rrf_score(rank)
            chunks_by_id.setdefault(chunk.chunk_id, chunk)

        for rank, chunk in enumerate(bm25_results):
            rrf_scores[chunk.chunk_id] = rrf_scores.get(chunk.chunk_id, 0.0) + _rrf_score(rank)
            chunks_by_id.setdefault(chunk.chunk_id, chunk)

        # Sort by combined RRF score descending, take top_k
        ranked_ids = sorted(rrf_scores, key=lambda cid: rrf_scores[cid], reverse=True)[:top_k]

        return [
            RetrievedChunk(
                **{**chunks_by_id[cid].model_dump(), "score": round(rrf_scores[cid], 6)}
            )
            for cid in ranked_ids
        ]
