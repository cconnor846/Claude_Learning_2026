"""Shared types for retrieval services.

All three retrieval strategies (vector, BM25, hybrid) return a list of
RetrievedChunk so that callers — the search route and future eval code —
work with a single consistent type regardless of strategy.
"""

import uuid

from pydantic import BaseModel


class RetrievedChunk(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_filename: str
    content: str
    score: float          # Higher is always better, regardless of strategy
    chunk_index: int
    chunking_strategy: str
    page_number: int | None
    metadata_: dict
