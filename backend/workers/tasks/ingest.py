"""Document ingestion pipeline — Celery task.

Flow:
  1. Mark document → processing
  2. Download raw bytes from MinIO
  3. Parse to text (pymupdf for PDF, decode for .txt)
  4. Chunk with FixedSizeChunker
  5. Embed with VoyageEmbedder (batched)
  6. Bulk-insert Chunk + Embedding records
  7. Mark document → ready
  On any error → rollback, open fresh session, mark document → failed
"""

import asyncio
import logging
import uuid

from celery import Task

from backend.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="backend.workers.tasks.ingest.run_ingestion_pipeline",
    max_retries=0,       # Handle retries manually; automatic retries could double-embed
    time_limit=300,      # Hard kill after 5 minutes
    soft_time_limit=240, # SIGTERM after 4 minutes — gives cleanup code time to run
)
def run_ingestion_pipeline(self: Task, document_id: str) -> dict[str, str]:
    """Synchronous Celery entry point — delegates to async pipeline."""
    return asyncio.run(_async_pipeline(document_id))


async def _async_pipeline(document_id: str) -> dict[str, str]:
    # All imports are lazy (inside this function) to avoid loading the full
    # application graph when Celery discovers tasks at worker startup.
    from backend.core.storage import storage
    from backend.models.database import async_session_factory
    from backend.models.tables.documents import Chunk, Document, DocumentStatus
    from backend.models.tables.embeddings import Embedding
    from backend.services.ingestion.chunker import FixedSizeChunker
    from backend.services.ingestion.embedder import VoyageEmbedder
    from backend.services.ingestion.parser import parse_document

    doc_uuid = uuid.UUID(document_id)
    chunker = FixedSizeChunker(chunk_size=1000, overlap=200)
    embedder = VoyageEmbedder()

    async with async_session_factory() as session:
        try:
            # ------------------------------------------------------------------
            # Step 1: Mark document as processing
            # ------------------------------------------------------------------
            doc = await session.get(Document, doc_uuid)
            if doc is None:
                raise ValueError(f"Document {document_id} not found in database")

            doc.status = DocumentStatus.processing
            await session.commit()
            logger.info("Ingestion started: document=%s", document_id)

            # ------------------------------------------------------------------
            # Step 2: Download raw file from MinIO
            # ------------------------------------------------------------------
            file_bytes = await storage.download_file(doc.file_path)
            logger.debug(
                "Downloaded %d bytes from MinIO: key=%s", len(file_bytes), doc.file_path
            )

            # ------------------------------------------------------------------
            # Step 3: Parse to text
            # ------------------------------------------------------------------
            parsed = await parse_document(
                content=file_bytes,
                mime_type=doc.mime_type,
                filename=doc.original_filename,
            )
            logger.debug(
                "Parsed document: pages=%d chars=%d", parsed.page_count, len(parsed.text)
            )

            # ------------------------------------------------------------------
            # Step 4: Chunk the text
            # ------------------------------------------------------------------
            chunk_data_list = await chunker.chunk(
                text=parsed.text,
                page_texts=parsed.page_texts,
                metadata={
                    "document_id": document_id,
                    "filename": doc.original_filename,
                },
            )
            logger.debug("Produced %d chunks", len(chunk_data_list))

            # ------------------------------------------------------------------
            # Step 5: Embed all chunks
            # ------------------------------------------------------------------
            texts = [cd.content for cd in chunk_data_list]
            vectors = await embedder.embed(texts)
            logger.debug("Embedded %d chunks via %s", len(vectors), embedder.model_name)

            # ------------------------------------------------------------------
            # Step 6: Insert Chunk + Embedding records
            # ------------------------------------------------------------------
            for cd, vector in zip(chunk_data_list, vectors):
                chunk = Chunk(
                    document_id=doc_uuid,
                    content=cd.content,
                    chunk_index=cd.chunk_index,
                    chunking_strategy=chunker.strategy_name,
                    page_number=cd.page_number,
                    section_title=cd.section_title,
                    char_count=cd.char_count,
                    token_count=None,  # Token counting deferred to Phase 4+
                    metadata_=cd.metadata,
                )
                session.add(chunk)
                # flush() writes the Chunk INSERT within the open transaction,
                # populating chunk.id so the Embedding FK reference is valid.
                await session.flush()

                embedding = Embedding(
                    chunk_id=chunk.id,
                    embedding_model=embedder.model_name,
                    embedding_model_version=embedder.model_version,
                    vector=vector,
                )
                session.add(embedding)

            # ------------------------------------------------------------------
            # Step 7: Mark document as ready and commit everything
            # ------------------------------------------------------------------
            doc.status = DocumentStatus.ready
            await session.commit()

            chunk_count = len(chunk_data_list)
            logger.info(
                "Ingestion complete: document=%s chunks=%d", document_id, chunk_count
            )
            return {
                "status": "ready",
                "document_id": document_id,
                "chunk_count": str(chunk_count),
            }

        except Exception as exc:
            await session.rollback()
            logger.exception("Ingestion failed for document %s", document_id)

            # Write the failed status in a fresh session — the rolled-back
            # session above is no longer safe to use after rollback.
            await _mark_failed(doc_uuid, exc)
            raise  # Re-raise so Celery records this task as FAILURE


async def _mark_failed(doc_uuid: uuid.UUID, exc: Exception) -> None:
    """Open a fresh session to persist the failed status and error message."""
    from backend.models.database import async_session_factory
    from backend.models.tables.documents import Document, DocumentStatus

    try:
        async with async_session_factory() as session:
            doc = await session.get(Document, doc_uuid)
            if doc is not None:
                doc.status = DocumentStatus.failed
                # Truncate to 2048 chars — error messages can be very long
                doc.error_message = str(exc)[:2048]
                await session.commit()
    except Exception:
        logger.exception(
            "Failed to persist error status for document %s", doc_uuid
        )
