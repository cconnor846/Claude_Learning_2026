"""ORM model: embeddings table with pgvector support."""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.database import Base


class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chunks.id", ondelete="CASCADE"),
        nullable=False,
    )
    embedding_model: Mapped[str] = mapped_column(String(127), nullable=False)
    embedding_model_version: Mapped[str] = mapped_column(String(63), nullable=False)
    # Vector dimension 1024 matches Voyage AI's voyage-3 model output.
    # pgvector.sqlalchemy.Vector provides the SQLAlchemy column type.
    vector: Mapped[list[float]] = mapped_column(Vector(1024), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    chunk: Mapped["Chunk"] = relationship(  # type: ignore[name-defined]
        "Chunk", back_populates="embeddings"
    )
