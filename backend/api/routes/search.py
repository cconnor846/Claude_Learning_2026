"""Search endpoint.

POST /api/v1/search  — retrieve chunks relevant to a query string.

Three strategies are supported:
  - vector  : pgvector cosine similarity against Voyage AI embeddings
  - bm25    : BM25 keyword search over all ready chunk contents
  - hybrid  : RRF fusion of vector + BM25 (recommended for production use)

The query is embedded on demand using VoyageQueryEmbedder (input_type="query").
BM25-only requests skip embedding entirely.
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.services.retrieval import RetrievedChunk

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(10, ge=1, le=50)
    strategy: Literal["vector", "bm25", "hybrid"] = "vector"
    document_ids: list[uuid.UUID] | None = None


class ChunkResult(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_filename: str
    content: str
    score: float
    chunk_index: int
    chunking_strategy: str
    page_number: int | None


class SearchResponse(BaseModel):
    query: str
    strategy: str
    total: int
    results: list[ChunkResult]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=SearchResponse,
    summary="Search chunks by query",
)
async def search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    """Retrieve chunks relevant to a natural-language query.

    - **vector**: semantic similarity via Voyage AI embeddings + pgvector.
      Best for conceptual or paraphrased queries.
    - **bm25**: keyword matching. Best for exact terminology or named entities.
    - **hybrid**: RRF fusion of both. Generally the strongest option.

    Results are ordered by score descending (higher = more relevant).
    Chunks from documents that are not yet in 'ready' status are excluded.
    """
    needs_embedding = request.strategy in ("vector", "hybrid")
    query_vector: list[float] | None = None

    if needs_embedding:
        from backend.services.ingestion.embedder import VoyageQueryEmbedder
        embedder = VoyageQueryEmbedder()
        vectors = await embedder.embed([request.query])
        query_vector = vectors[0]

    results: list[RetrievedChunk]

    if request.strategy == "vector":
        from backend.services.retrieval.vector import VectorRetriever
        assert query_vector is not None
        retriever = VectorRetriever()
        results = await retriever.search(
            db,
            query_vector=query_vector,
            top_k=request.top_k,
            document_ids=request.document_ids,
        )

    elif request.strategy == "bm25":
        from backend.services.retrieval.bm25 import BM25Retriever
        retriever = BM25Retriever()
        results = await retriever.search(
            db,
            query=request.query,
            top_k=request.top_k,
            document_ids=request.document_ids,
        )

    else:  # hybrid
        from backend.services.retrieval.hybrid import HybridRetriever
        assert query_vector is not None
        retriever = HybridRetriever()
        results = await retriever.search(
            db,
            query=request.query,
            query_vector=query_vector,
            top_k=request.top_k,
            document_ids=request.document_ids,
        )

    return SearchResponse(
        query=request.query,
        strategy=request.strategy,
        total=len(results),
        results=[
            ChunkResult(
                chunk_id=r.chunk_id,
                document_id=r.document_id,
                document_filename=r.document_filename,
                content=r.content,
                score=r.score,
                chunk_index=r.chunk_index,
                chunking_strategy=r.chunking_strategy,
                page_number=r.page_number,
            )
            for r in results
        ],
    )
