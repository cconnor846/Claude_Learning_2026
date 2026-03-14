"""BM25 keyword retrieval using the rank-bm25 library.

Loads all ready chunks from Postgres, builds a BM25Okapi index in memory,
and scores the query against it. Returns results ordered by score descending,
filtered to chunks with score > 0.

Tokenisation: lowercase → strip punctuation → whitespace split.
This is intentionally simple — the vector retriever handles semantic matching,
so BM25 just needs to be good at exact and near-exact term matching.

Scaling note: loading all chunks per request is fine at learning-scale but
will degrade as the corpus grows. The natural upgrade is to cache the index
and invalidate it when new documents reach 'ready' status.
"""

import re
import uuid

from rank_bm25 import BM25Okapi
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.tables.documents import Chunk, Document, DocumentStatus
from backend.services.retrieval import RetrievedChunk


def _tokenize(text: str) -> list[str]:
    """Lowercase, strip punctuation, split on whitespace."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    return text.split()


class BM25Retriever:
    async def search(
        self,
        db: AsyncSession,
        query: str,
        top_k: int = 10,
        document_ids: list[uuid.UUID] | None = None,
    ) -> list[RetrievedChunk]:
        """Return the top_k chunks by BM25 score for the given query string.

        Chunks with a BM25 score of 0 are excluded from results — they share
        no terms with the query and would only add noise in hybrid merging.

        Args:
            db: Async SQLAlchemy session.
            query: Raw query string (not pre-embedded).
            top_k: Maximum number of results to return.
            document_ids: If provided, restricts search to these documents only.
        """
        stmt = (
            select(Chunk, Document.filename)
            .join(Document, Document.id == Chunk.document_id)
            .where(Document.status == DocumentStatus.ready)
            .order_by(Chunk.document_id, Chunk.chunk_index)
        )

        if document_ids:
            stmt = stmt.where(Chunk.document_id.in_(document_ids))

        result = await db.execute(stmt)
        rows = result.all()

        if not rows:
            return []

        chunks: list[Chunk] = [row[0] for row in rows]
        filenames: list[str] = [row[1] for row in rows]

        # Build BM25 index over the loaded corpus
        tokenized_corpus = [_tokenize(c.content) for c in chunks]
        bm25 = BM25Okapi(tokenized_corpus)

        query_tokens = _tokenize(query)
        scores = bm25.get_scores(query_tokens)

        # Sort by score descending, take top_k, drop zero-score results
        ranked_indices = sorted(
            range(len(scores)), key=lambda i: scores[i], reverse=True
        )[:top_k]

        return [
            RetrievedChunk(
                chunk_id=chunks[idx].id,
                document_id=chunks[idx].document_id,
                document_filename=filenames[idx],
                content=chunks[idx].content,
                score=float(scores[idx]),
                chunk_index=chunks[idx].chunk_index,
                chunking_strategy=chunks[idx].chunking_strategy,
                page_number=chunks[idx].page_number,
                metadata_=chunks[idx].metadata_,
            )
            for idx in ranked_indices
            if scores[idx] > 0
        ]
