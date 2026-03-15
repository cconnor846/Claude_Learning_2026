from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.core.config import settings
from backend.core.storage import storage
from backend.models.database import engine


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup: verify DB connectivity and ensure MinIO bucket exists.
    # Both fail fast with a clear error if the service is unreachable.
    async with engine.begin() as conn:
        await conn.run_sync(lambda _: None)
    await storage.ensure_bucket()
    yield
    # Shutdown: close all connections in the pool gracefully.
    await engine.dispose()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="RAG Platform",
    description="A full-stack RAG platform for learning LLM/RAG techniques.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.environment == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    environment: str
    version: str


@app.get("/health", response_model=HealthResponse, tags=["meta"])
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        version=app.version,
    )


# ---------------------------------------------------------------------------
# Routers (included as each phase is implemented)
# ---------------------------------------------------------------------------

from backend.api.routes import documents, search, chat, evals

app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(evals.router, prefix="/api/v1/evals", tags=["evals"])

# Uncommented as each phase is implemented:
# from backend.api.routes import chunks, metrics
# app.include_router(chunks.router, prefix="/api/v1/chunks", tags=["chunks"])
# app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
