"""Vector similarity retrieval using pgvector.

Queries the embeddings table using cosine distance (the <=> operator),
joined to chunks and documents to return enriched results.

Score is converted to similarity: score = 1 - cosine_distance,
so 1.0 = identical and 0.0 = orthogonal. Higher is always better.

Only chunks belonging to documents with status='ready' are searched.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.tables.documents import Chunk, Document, DocumentStatus
from backend.models.tables.embeddings import Embedding
from backend.services.retrieval import RetrievedChunk


class VectorRetriever:
    async def search(
        self,
        db: AsyncSession,
        query_vector: list[float],
        top_k: int = 10,
        document_ids: list[uuid.UUID] | None = None,
    ) -> list[RetrievedChunk]:
        """Return the top_k most similar chunks to query_vector.

        Uses pgvector cosine distance (<=>). Joins embeddings → chunks →
        documents in one query so callers get filename alongside chunk data.

        Args:
            db: Async SQLAlchemy session.
            query_vector: Embedded query — must use input_type="query" from Voyage.
            top_k: Maximum number of results to return.
            document_ids: If provided, restricts search to these documents only.
        """
        distance_col = Embedding.vector.cosine_distance(query_vector).label("distance")

        stmt = (
            select(Chunk, Document.filename, distance_col)
            .join(Embedding, Embedding.chunk_id == Chunk.id)
            .join(Document, Document.id == Chunk.document_id)
            .where(Document.status == DocumentStatus.ready)
            .order_by(distance_col)
            .limit(top_k)
        )

        if document_ids:
            stmt = stmt.where(Chunk.document_id.in_(document_ids))

        result = await db.execute(stmt)
        rows = result.all()

        return [
            RetrievedChunk(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                document_filename=filename,
                content=chunk.content,
                score=round(1.0 - float(distance), 6),
                chunk_index=chunk.chunk_index,
                chunking_strategy=chunk.chunking_strategy,
                page_number=chunk.page_number,
                metadata_=chunk.metadata_,
            )
            for chunk, filename, distance in rows
        ]
