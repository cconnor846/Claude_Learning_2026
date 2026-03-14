# CLAUDE.md — RAG Platform Project Bible

This file is the authoritative reference for all Claude Code sessions on this project.
Read this fully before writing any code. All decisions here are intentional — do not
deviate without explicit instruction.

---

## Project Overview

A full-stack, open-source RAG (Retrieval-Augmented Generation) platform for learning
modern LLM/RAG techniques. The platform supports document ingestion, chunking strategy
experimentation, embedding, retrieval, evaluation, and observability — all in one system.

**Primary goal: learning and experimentation, not shipping fast.**
Favour explicitness, clarity, and measurability over cleverness or brevity.

---

## Non-Negotiables

- All Python must use **type hints** throughout — no untyped functions
- All Python must use **async/await** patterns where I/O is involved
- All dependencies managed with **uv** — never use pip directly
- No LangChain, LlamaIndex, or similar pipeline frameworks — use raw SDKs and primitives
- Everything must run via **Docker Compose** — no cloud dependencies
- All code must be **open source compatible** (no proprietary tooling baked in)
- Every database migration must use **Alembic** — never modify schema directly
- All API endpoints must have **Pydantic request/response models**
- No hardcoded secrets — always use **environment variables** via `.env`

---

## Tech Stack

### Backend
| Concern | Tool | Notes |
|---|---|---|
| API framework | FastAPI | Async, typed, auto-docs at /docs |
| Python runtime | Python 3.12 | |
| Dependency management | uv | pyproject.toml, never requirements.txt |
| Database ORM | SQLAlchemy 2.0 | Async sessions only |
| Migrations | Alembic | Every schema change needs a migration |
| Task queue | Celery + Redis | All ingestion jobs are async tasks |
| Data validation | Pydantic v2 | Request/response models for all endpoints |
| Testing | pytest + pytest-asyncio | Aim for coverage on services layer |

### Frontend
| Concern | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| API client | fetch with typed wrappers |
| State management | React state + SWR for data fetching |

### AI / ML
| Concern | Tool | Notes |
|---|---|---|
| LLM | Anthropic Claude | claude-3-5-sonnet for quality, claude-3-5-haiku for eval/cheap tasks |
| Embeddings | Voyage AI | voyage-3 model, via voyageai SDK |
| Keyword search | rank-bm25 | For hybrid search alongside vector |
| Observability | LangFuse (self-hosted) | Traces, evals, prompt management |

### Infrastructure (Docker Compose)
| Service | Purpose |
|---|---|
| postgres | Primary database + pgvector extension |
| redis | Celery broker + result backend |
| minio | S3-compatible object storage for raw files |
| langfuse | LLM observability (self-hosted) |
| prometheus | Metrics collection |
| grafana | Token/cost/request dashboard |
| backend | FastAPI app |
| worker | Celery worker |
| frontend | Next.js app |

---

## Repository Structure

```
rag-platform/
├── CLAUDE.md                  ← This file
├── README.md
├── .env.example               ← All required env vars documented here
├── .gitignore
├── docker-compose.yml
├── docker-compose.dev.yml     ← Dev overrides (hot reload, volume mounts)
├── pyproject.toml             ← Python project config (uv)
│
├── backend/
│   ├── Dockerfile
│   ├── main.py                ← FastAPI app entrypoint
│   ├── api/
│   │   ├── routes/
│   │   │   ├── documents.py   ← Upload, list, delete documents
│   │   │   ├── chunks.py      ← Chunk inspection endpoints
│   │   │   ├── search.py      ← Retrieval endpoints
│   │   │   ├── chat.py        ← Chatbot endpoints (streaming)
│   │   │   ├── evals.py       ← Evaluation run endpoints
│   │   │   └── metrics.py     ← Prometheus metrics endpoint
│   │   └── deps.py            ← FastAPI dependency injection
│   ├── services/
│   │   ├── ingestion/
│   │   │   ├── parser.py      ← Document parsing (pymupdf, etc)
│   │   │   ├── chunker.py     ← Chunking strategies (pluggable)
│   │   │   └── embedder.py    ← Embedding interface (pluggable)
│   │   ├── retrieval/
│   │   │   ├── vector.py      ← pgvector similarity search
│   │   │   ├── bm25.py        ← BM25 keyword search
│   │   │   └── hybrid.py      ← Hybrid search + reranking
│   │   ├── generation/
│   │   │   ├── claude.py      ← Anthropic SDK wrapper
│   │   │   └── prompts.py     ← Prompt templates (versioned)
│   │   └── evaluation/
│   │       ├── synthetic.py   ← QA pair generation from docs
│   │       └── metrics.py     ← Faithfulness, relevance, recall
│   ├── workers/
│   │   ├── celery_app.py      ← Celery configuration
│   │   └── tasks/
│   │       ├── ingest.py      ← Document ingestion task pipeline
│   │       └── eval.py        ← Async eval run tasks
│   ├── models/
│   │   ├── database.py        ← SQLAlchemy base + session
│   │   └── tables/
│   │       ├── documents.py   ← Document + chunk tables
│   │       ├── embeddings.py  ← Embedding metadata
│   │       ├── experiments.py ← Eval experiments + results
│   │       └── prompts.py     ← Prompt versions
│   ├── core/
│   │   ├── config.py          ← Pydantic Settings, loads .env
│   │   └── storage.py         ← MinIO client wrapper
│   └── migrations/            ← Alembic migration files
│
├── frontend/
│   ├── Dockerfile
│   ├── app/                   ← Next.js App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx           ← Home / dashboard
│   │   ├── documents/         ← Document management UI
│   │   ├── chat/              ← Chatbot UI
│   │   ├── experiments/       ← Eval experiment UI
│   │   └── dashboard/         ← Token/cost/metrics dashboard
│   ├── components/            ← Reusable shadcn + custom components
│   └── lib/                   ← API client, types, utilities
│
├── infra/
│   ├── prometheus.yml
│   └── grafana/
│       └── dashboards/
│
├── evals/
│   ├── datasets/              ← Test QA pairs (JSON)
│   └── scripts/               ← Standalone eval runner scripts
│
└── docs/
    ├── architecture.md        ← Key architectural decisions + rationale
    ├── chunking-strategies.md ← Notes on chunking experiments
    └── eval-methodology.md    ← How evaluation works in this system
```

---

## Key Architectural Patterns

### Pluggable services
Chunking, embedding, and retrieval strategies must be implemented as swappable classes
behind a common interface. This is how we compare strategies experimentally.

Example pattern for chunkers:
```python
from abc import ABC, abstractmethod

class BaseChunker(ABC):
    @abstractmethod
    async def chunk(self, text: str, metadata: dict) -> list[Chunk]:
        ...

class FixedSizeChunker(BaseChunker): ...
class SemanticChunker(BaseChunker): ...
class StructureAwareChunker(BaseChunker): ...
```

### Document lineage — track everything
Every chunk must reference:
- Source document ID
- Ingestion timestamp
- Chunking strategy used (name + version)
- Embedding model used (name + version)
- Page number / section (where available)

This metadata is what makes evaluation and debugging possible.

### Async ingestion pipeline
Document upload → store raw file in MinIO → create Document record in Postgres →
enqueue Celery task → worker parses → chunks → embeds → stores chunks with lineage.
API returns immediately with a job ID. Frontend polls for status.

### Evaluation first
Every chunking/retrieval experiment must be measurable. Before building a new strategy,
ensure there is an eval dataset and metrics to run against it.

---

## Environment Variables

All secrets and config live in `.env`. The `.env.example` file must always be kept
up to date with every variable the system needs.

Required variables:
```
# Anthropic
ANTHROPIC_API_KEY=

# Voyage AI
VOYAGE_API_KEY=

# PostgreSQL
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
DATABASE_URL=

# Redis
REDIS_URL=

# MinIO
MINIO_ROOT_USER=
MINIO_ROOT_PASSWORD=
MINIO_ENDPOINT=

# LangFuse
LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_HOST=

# App
ENVIRONMENT=development
LOG_LEVEL=INFO
```

---

## Development Workflow

1. All new features on a **feature branch** — never commit directly to main
2. Commit small and often with meaningful messages
3. Every new service or utility needs at least a basic test
4. Run `docker compose up` to start the full stack
5. Backend hot-reloads via uvicorn `--reload` in dev mode
6. Frontend hot-reloads via Next.js dev server

---

## What We Are NOT Doing

- No LangChain, LlamaIndex, or similar abstraction frameworks
- No cloud deployment (local Docker Compose only)
- No authentication system beyond a simple API key (for now)
- No multi-tenancy
- No structured data / Text-to-SQL (Phase 8, later)
- No TypeScript `any` types in the frontend
- No `requirements.txt` — use `pyproject.toml` with uv only

---

## Build Progress

### Phase 1 — Infrastructure & Skeleton ✅ COMPLETE

**Completed (committed + pushed to main on 2026-03-08)**

| File | Purpose |
|---|---|
| `docker-compose.yml` | All 9 services: postgres/pgvector, redis, minio, langfuse, prometheus, grafana, backend, worker, frontend |
| `docker-compose.dev.yml` | Hot-reload overrides for backend, worker, frontend |
| `pyproject.toml` | uv project config with full dependency list |
| `backend/Dockerfile` | Python 3.12-slim + uv, build context is repo root |
| `backend/__init__.py` | Makes backend a Python package |
| `backend/main.py` | FastAPI app with lifespan, CORS, `GET /health` (HealthResponse Pydantic model), stubbed router includes |
| `backend/core/__init__.py` | Package init |
| `backend/core/config.py` | Pydantic Settings class loading all env vars from `.env` |
| `backend/api/__init__.py` | Package init |
| `backend/api/deps.py` | Stub for future DB session / dependency injection |
| `backend/api/routes/__init__.py` | Package init |
| `.env.example` | All required env vars documented with safe placeholder defaults |
| `infra/prometheus.yml` | Scrapes backend `/metrics` every 15s |
| `infra/postgres/init.sql` | Auto-creates `langfuse` database on first postgres start |
| `infra/grafana/dashboards/.gitkeep` | Placeholder for future dashboard provisioning |

**Completed on 2026-03-09**

- [x] `cp .env.example .env` and filled in ANTHROPIC_API_KEY and VOYAGE_API_KEY
- [x] `uv sync` — 121 packages installed successfully into `.venv`

**Completed on 2026-03-10**

- [x] Installed Docker Engine directly in WSL2 Ubuntu 24.04 (Docker Desktop for Windows not used)
  - Added docker apt repo, installed docker-ce + docker-compose-plugin
  - Added user to `docker` group
  - Fixed healthcheck bug in `docker-compose.yml`: added `-d ${POSTGRES_DB}` to `pg_isready` command
  - `docker compose up postgres redis` — postgres/pgvector starts cleanly
  - `langfuse` DB confirmed created by `infra/postgres/init.sql`
  - All 5 expected databases verified: `rag_platform`, `langfuse`, `postgres`, `template0`, `template1`

**Phase 1 complete. No pending items.**

**Business logic: none yet. Pure skeleton.**

---

### Phase 2 — Database Models + Migrations ✅ COMPLETE

**Completed on 2026-03-12**

| File | Purpose |
|---|---|
| `pyproject.toml` | Added `pgvector>=0.4.2` dependency |
| `backend/models/database.py` | `Base` (DeclarativeBase), async engine, `async_session_factory` |
| `backend/models/tables/documents.py` | `Document` + `Chunk` ORM models, `DocumentStatus` enum |
| `backend/models/tables/embeddings.py` | `Embedding` model with `Vector(1024)` (voyage-3 dim) |
| `backend/models/tables/experiments.py` | `Experiment` + `EvalResult` models, `ExperimentStatus` enum |
| `backend/models/tables/prompts.py` | `PromptVersion` model, unique `(name, version)` constraint |
| `backend/api/deps.py` | Real `get_db()` async dependency — auto-commit/rollback pattern |
| `backend/main.py` | Lifespan pings DB on startup, disposes engine on shutdown |
| `alembic.ini` | Alembic config — URL set from settings in env.py, not hardcoded |
| `backend/migrations/env.py` | Full async Alembic env (replaced sync default) |
| `backend/migrations/versions/3b1fa3c60faa_create_initial_tables.py` | First migration — all 6 tables + pgvector extension |

**Key decisions recorded:**
- `expire_on_commit=False` on session factory — prevents `MissingGreenlet` errors in async context
- `server_default=func.now()` on all timestamps — DB sets time, not Python
- `JSONB` (not `JSON`) on all JSON columns — indexed and queryable in Postgres
- `ondelete="CASCADE"` on all FKs — DB enforces cascading deletes
- `metadata_` attribute with `mapped_column("metadata", ...)` — avoids SQLAlchemy reserved name conflict
- `NullPool` in Alembic env.py — migrations are one-shot, don't hold connections between steps
- Migration workflow: `docker compose run --rm backend uv run alembic upgrade head` (not baked into container startup)

**Verified in Postgres:** 7 tables, `vector(1024)` column, both enum types, pgvector v0.8.2 installed, revision `3b1fa3c60faa` tracked.

---

### Phase 3 — Ingestion Pipeline ✅ COMPLETE

**Completed on 2026-03-12**

| File | Purpose |
|---|---|
| `backend/core/storage.py` | Async MinIO wrapper (`upload_file`, `download_file`, `ensure_bucket`) using `run_in_executor` |
| `backend/services/ingestion/parser.py` | PDF (pymupdf) + plain text parser → `ParsedDocument` with per-page texts |
| `backend/services/ingestion/chunker.py` | `BaseChunker` ABC + `FixedSizeChunker` (1000 chars, 200 overlap, lineage in metadata) |
| `backend/services/ingestion/embedder.py` | `BaseEmbedder` ABC + `VoyageEmbedder` (batch=32, exponential backoff on rate limit) |
| `backend/workers/celery_app.py` | Celery config — `ingestion` queue, `task_acks_late=True`, `prefetch_multiplier=1` |
| `backend/workers/tasks/ingest.py` | 7-step async pipeline: process → download → parse → chunk → embed → insert → ready |
| `backend/api/routes/documents.py` | 4 endpoints: POST upload (202), GET list, GET detail+chunk count, GET chunks |
| `pyproject.toml` | Added `python-multipart` (required by FastAPI for file uploads) |

**Updated files:**
- `backend/main.py` — documents router wired in, `storage.ensure_bucket()` in lifespan
- `docker-compose.yml` — `-Q ingestion` on worker command, MinIO health dependency on backend + worker

**Key decisions recorded:**
- `asyncio.run()` bridge in Celery task — no gevent/eventlet required
- Lazy imports inside `_async_pipeline` — avoids circular imports at Celery task discovery time
- Separate fresh session in `_mark_failed()` — rolled-back session is not safe to reuse
- `task_acks_late=True` — task re-queued if worker crashes mid-pipeline
- `input_type="document"` in VoyageEmbedder — retrieval service must use `"query"` in Phase 4
- Token counting deferred — `token_count` column left null, to be filled in Phase 4+
- Filename stored as-is (note: sanitise for production) — UUID prefix on object key prevents MinIO path traversal

---

### Phase 4 — Retrieval ✅ COMPLETE

**Completed on 2026-03-13**

| File | Purpose |
|---|---|
| `backend/services/retrieval/__init__.py` | Shared `RetrievedChunk` Pydantic model — single return type for all strategies |
| `backend/services/retrieval/vector.py` | `VectorRetriever` — pgvector cosine distance (`<=>`), joins embeddings → chunks → documents |
| `backend/services/retrieval/bm25.py` | `BM25Retriever` — in-memory `BM25Okapi` index, zero-score results excluded |
| `backend/services/retrieval/hybrid.py` | `HybridRetriever` — RRF fusion (k=60) of vector + BM25 at 3× candidate count |
| `backend/api/routes/search.py` | `POST /api/v1/search` — strategy dispatch, embedding skipped for bm25-only requests |
| `backend/services/ingestion/embedder.py` | Added `VoyageQueryEmbedder` subclass (`INPUT_TYPE = "query"`) |

**Updated files:**
- `backend/main.py` — search router wired in at `/api/v1/search`

**Key decisions recorded:**
- `VoyageQueryEmbedder` is a one-line subclass of `VoyageEmbedder` — keeps document and query embedding paths explicit and separate
- Score normalised to "higher = better" across all strategies: vector uses `1 - cosine_distance`, BM25 uses raw BM25 score, hybrid uses RRF score
- BM25 tokenisation: lowercase + `re.sub(r"[^\w\s]", "", text)` + whitespace split — no NLTK dependency
- BM25 index built in-memory per request (sufficient at learning-scale; TODO: cache index keyed on corpus size)
- `document_ids` filter applied at SQL level in both vector and BM25 queries — not post-filtered in Python
- Search response enriched with `document_filename` via JOIN to documents table — avoids UUID-only results
- No new Alembic migration required — Phase 4 is read-only against existing schema

---

### Phase 5 — Generation (NOT STARTED)

**Start next session by planning Phase 5.**

Planned work:
- `backend/services/generation/claude.py` — Anthropic SDK wrapper (streaming + non-streaming)
- `backend/services/generation/prompts.py` — versioned prompt templates
- `backend/api/routes/chat.py` — streaming chat endpoint (`GET /api/v1/chat`)
- RAG pipeline: search → retrieve chunks → build prompt → stream Claude response

---

### Phase 6+ — Not started

Evaluation, frontend — all pending.
