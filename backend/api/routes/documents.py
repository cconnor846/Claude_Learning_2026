"""Document management endpoints.

POST   /api/v1/documents                  — upload a document
GET    /api/v1/documents                  — list documents
GET    /api/v1/documents/{id}             — get document detail + chunk count
GET    /api/v1/documents/{id}/chunks      — list chunks for a document
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.core.storage import storage
from backend.models.tables.documents import Chunk, Document, DocumentStatus

router = APIRouter()

ALLOWED_MIME_TYPES: set[str] = {"application/pdf", "text/plain", "text/markdown"}
MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class DocumentUploadResponse(BaseModel):
    document_id: uuid.UUID
    status: DocumentStatus
    status_url: str  # Clients poll this URL to check processing status


class DocumentListItem(BaseModel):
    document_id: uuid.UUID
    filename: str
    original_filename: str
    mime_type: str
    file_size_bytes: int
    status: DocumentStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class DocumentDetail(DocumentListItem):
    chunk_count: int


class ChunkItem(BaseModel):
    chunk_id: uuid.UUID
    chunk_index: int
    content: str
    char_count: int
    chunking_strategy: str
    page_number: int | None
    section_title: str | None
    created_at: datetime


class ChunkListResponse(BaseModel):
    document_id: uuid.UUID
    total_chunks: int
    chunks: list[ChunkItem]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _document_to_list_item(doc: Document) -> DocumentListItem:
    return DocumentListItem(
        document_id=doc.id,
        filename=doc.filename,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        file_size_bytes=doc.file_size_bytes,
        status=doc.status,
        error_message=doc.error_message,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a document for ingestion",
)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> DocumentUploadResponse:
    """Accept a file upload, store it in MinIO, create a Document record,
    and enqueue the ingestion pipeline. Returns immediately with 202 Accepted.

    The document status starts as 'pending' and transitions to 'processing'
    then 'ready' (or 'failed') as the Celery worker runs the pipeline.
    Poll GET /api/v1/documents/{id} to check progress.
    """
    # Validate MIME type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type '{content_type}'. "
                f"Accepted types: {', '.join(sorted(ALLOWED_MIME_TYPES))}"
            ),
        )

    # Read file into memory and enforce size limit
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"File size {len(content):,} bytes exceeds the "
                f"{MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB limit."
            ),
        )

    doc_id = uuid.uuid4()
    original_filename = file.filename or "unknown"
    # Sanitisation note: filename is user-supplied. The UUID prefix on the
    # object key prevents path traversal in MinIO. For a production system,
    # strip path separators and control characters from the filename.
    object_key = f"{doc_id}/{original_filename}"

    # Upload to MinIO
    await storage.ensure_bucket()
    await storage.upload_file(object_key, content, content_type)

    # Create Document record (status=pending)
    doc = Document(
        id=doc_id,
        filename=original_filename,
        original_filename=original_filename,
        file_path=object_key,
        mime_type=content_type,
        file_size_bytes=len(content),
        status=DocumentStatus.pending,
    )
    db.add(doc)
    # deps.get_db() commits on response — the record is written when this
    # function returns. We enqueue the Celery task after the add so that
    # by the time the worker starts, the Document row definitely exists.
    await db.flush()  # Ensure the row is written before enqueueing

    # Enqueue the ingestion pipeline
    from backend.workers.tasks.ingest import run_ingestion_pipeline  # lazy import
    run_ingestion_pipeline.delay(str(doc_id))

    return DocumentUploadResponse(
        document_id=doc_id,
        status=DocumentStatus.pending,
        status_url=f"/api/v1/documents/{doc_id}",
    )


@router.get(
    "",
    response_model=list[DocumentListItem],
    summary="List all documents",
)
async def list_documents(
    db: AsyncSession = Depends(get_db),
    status_filter: DocumentStatus | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[DocumentListItem]:
    """Return a paginated list of documents, optionally filtered by status."""
    stmt = select(Document).order_by(Document.created_at.desc())

    if status_filter is not None:
        stmt = stmt.where(Document.status == status_filter)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    docs = result.scalars().all()
    return [_document_to_list_item(doc) for doc in docs]


@router.get(
    "/{document_id}",
    response_model=DocumentDetail,
    summary="Get document detail and chunk count",
)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> DocumentDetail:
    """Return document metadata plus the number of chunks produced.

    Use this endpoint to poll ingestion status. When status transitions to
    'ready', chunk_count reflects how many chunks were produced.
    """
    doc = await db.get(Document, document_id)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found",
        )

    count_result = await db.execute(
        select(func.count()).where(Chunk.document_id == document_id)
    )
    chunk_count: int = count_result.scalar_one()

    return DocumentDetail(
        **_document_to_list_item(doc).model_dump(),
        chunk_count=chunk_count,
    )


@router.get(
    "/{document_id}/chunks",
    response_model=ChunkListResponse,
    summary="List chunks for a document",
)
async def list_document_chunks(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> ChunkListResponse:
    """Return paginated chunks for a document, ordered by chunk_index.

    Useful for inspecting what the chunking strategy produced and verifying
    that document lineage metadata is correctly recorded.
    """
    doc = await db.get(Document, document_id)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found",
        )

    count_result = await db.execute(
        select(func.count()).where(Chunk.document_id == document_id)
    )
    total_chunks: int = count_result.scalar_one()

    chunks_result = await db.execute(
        select(Chunk)
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.chunk_index)
        .limit(limit)
        .offset(offset)
    )
    chunks = chunks_result.scalars().all()

    return ChunkListResponse(
        document_id=document_id,
        total_chunks=total_chunks,
        chunks=[
            ChunkItem(
                chunk_id=c.id,
                chunk_index=c.chunk_index,
                content=c.content,
                char_count=c.char_count,
                chunking_strategy=c.chunking_strategy,
                page_number=c.page_number,
                section_title=c.section_title,
                created_at=c.created_at,
            )
            for c in chunks
        ],
    )
