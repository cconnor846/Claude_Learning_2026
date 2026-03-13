# RAG Platform

A full-stack, open-source Retrieval-Augmented Generation platform built for learning modern LLM/RAG techniques from the ground up — no magic frameworks, no black boxes, just raw SDKs and honest engineering.

Upload documents. Chunk them. Embed them. Retrieve them. Generate answers. Measure everything. Understand exactly what's happening at each step.

---

## What This Is

Most RAG tutorials hand you a LangChain one-liner and call it a day. This project goes the other direction: every stage of the pipeline is built explicitly, with pluggable strategies, full observability, and evaluation built in from the start.

It's a learning project, which means the goal is *understanding* — not shipping fast. Explicitness is preferred over cleverness. Every architectural decision is documented.

---

## Features

- **Document ingestion** — upload PDFs and text files, store them in MinIO, parse and chunk them automatically
- **Pluggable chunking** — swap chunking strategies (fixed-size, semantic, structure-aware) and compare results
- **Vector embeddings** — Voyage AI `voyage-3` embeddings stored in pgvector
- **Hybrid search** — vector similarity + BM25 keyword search with reranking *(Phase 4)*
- **RAG generation** — Claude-powered answers grounded in retrieved context *(Phase 5)*
- **Evaluation** — synthetic QA pair generation, faithfulness/relevance/recall scoring *(Phase 5)*
- **Observability** — LangFuse traces, Prometheus metrics, Grafana dashboards *(Phase 6)*
- **Experiment tracking** — every chunking/retrieval run is tied to a named experiment with stored config and results

---

## Tech Stack

| Layer | Tech |
|---|---|
| API | FastAPI (async, auto-docs at `/docs`) |
| Database | PostgreSQL 16 + pgvector |
| ORM / migrations | SQLAlchemy 2.0 async + Alembic |
| Task queue | Celery + Redis |
| Object storage | MinIO (S3-compatible) |
| LLM | Anthropic Claude |
| Embeddings | Voyage AI `voyage-3` (1024 dims) |
| Keyword search | rank-bm25 |
| Observability | LangFuse (self-hosted) + Prometheus + Grafana |
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui *(Phase 7)* |
| Runtime | Python 3.12, uv |
| Infrastructure | Docker Compose — runs entirely locally |

---

## Project Structure

```
rag-platform/
├── backend/
│   ├── api/routes/          # FastAPI endpoints
│   ├── core/                # Config (Pydantic Settings) + MinIO client
│   ├── models/              # SQLAlchemy ORM models + Alembic migrations
│   ├── services/
│   │   └── ingestion/       # Parser, chunker, embedder (all pluggable)
│   └── workers/             # Celery app + ingestion pipeline task
├── frontend/                # Next.js app (Phase 7)
├── infra/                   # Prometheus config, Grafana dashboards
├── evals/                   # Evaluation datasets and scripts
├── docs/                    # Architecture notes, chunking strategy docs
├── docker-compose.yml       # Full 9-service stack
└── pyproject.toml           # uv project config
```

---

## Getting Started

### Prerequisites

- Docker Engine + Docker Compose plugin
- [uv](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Anthropic API key
- Voyage AI API key

### 1. Clone and configure

```bash
git clone https://github.com/cconnor846/Claude_Learning_2026.git
cd Claude_Learning_2026
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and VOYAGE_API_KEY in .env
```

### 2. Install Python dependencies

```bash
uv sync
```

### 3. Start infrastructure

```bash
docker compose up postgres redis minio -d
```

### 4. Run migrations

```bash
docker compose run --rm backend uv run alembic upgrade head
```

### 5. Start the full stack

```bash
docker compose up
```

| Service | URL |
|---|---|
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| MinIO console | http://localhost:9001 |
| LangFuse | http://localhost:3000 |
| Grafana | http://localhost:3001 |

### 6. Upload a document

```bash
curl -X POST http://localhost:8000/api/v1/documents \
  -F "file=@/path/to/your/document.pdf"
```

Returns a document ID. Poll for status:

```bash
curl http://localhost:8000/api/v1/documents/{document_id}
```

Status moves from `pending` → `processing` → `ready` as the Celery worker parses, chunks, and embeds the document.

Inspect the chunks produced:

```bash
curl http://localhost:8000/api/v1/documents/{document_id}/chunks
```

---

## Architecture Decisions

**No framework pipelines.** LangChain and LlamaIndex are powerful but opaque. This project uses raw SDKs so every step is visible and controllable.

**Pluggable everything.** Chunkers and embedders implement abstract base classes. Swapping strategy = instantiating a different class. No other code changes. This makes experimentation measurable.

**Async all the way.** FastAPI, SQLAlchemy 2.0 async sessions, Voyage AI async client, MinIO offloaded to executor. The Celery worker bridges into async via `asyncio.run()`.

**Document lineage on every chunk.** Each chunk stores the document ID, chunking strategy name+version, embedding model, and page number. Without this, evaluation and debugging are guesswork.

**Evaluation first.** Every new chunking or retrieval strategy gets measured against a consistent eval dataset before conclusions are drawn.

**Local only.** The entire stack runs on your machine via Docker Compose. No cloud accounts required beyond the AI API keys.

For full architectural rationale, see [`CLAUDE.md`](./CLAUDE.md) and the [`docs/`](./docs/) directory.

---

## Build Progress

| Phase | Status | Description |
|---|---|---|
| 1 | Complete | Infrastructure, Docker Compose stack, FastAPI skeleton |
| 2 | Complete | SQLAlchemy models, Alembic migrations, DB wiring |
| 3 | Complete | Document ingestion pipeline (upload → parse → chunk → embed) |
| 4 | Planned | Retrieval (vector search, BM25, hybrid + reranking) |
| 5 | Planned | RAG generation (Claude), evaluation framework |
| 6 | Planned | Observability (LangFuse traces, Prometheus, Grafana) |
| 7 | Planned | Frontend (Next.js document manager + chat UI) |
| 8 | Future | Structured data / Text-to-SQL |

---

## Non-Goals

- No LangChain, LlamaIndex, or similar abstraction frameworks
- No cloud deployment — local Docker Compose only
- No multi-tenancy
- No `requirements.txt` — `pyproject.toml` with uv only
- No TypeScript `any` types in the frontend

---

## License

MIT
