"""RAG chat endpoint — streams a Claude response via Server-Sent Events.

POST /api/v1/chat

Pipeline:
  1. Embed the query (VoyageQueryEmbedder, input_type="query")
  2. Retrieve relevant chunks (vector / bm25 / hybrid)
  3. Register the prompt template in prompt_versions (INSERT ON CONFLICT DO NOTHING)
  4. Build system prompt + user message from the template
  5. Return a StreamingResponse that emits three SSE event types:
       sources — the retrieved chunks (emitted first, before generation starts)
       token   — one event per streamed text delta from Claude
       done    — signals the end of the stream

SSE event format:
  event: sources
  data: [{"chunk_id": "...", "document_filename": "...", "content": "...", ...}]

  event: token
  data: "The "

  event: done
  data: [DONE]

Sources are emitted before the first token so the UI can render source cards
immediately while Claude is still generating the answer.

Multi-turn note: currently single-turn only. The ClaudeClient.stream() wrapper
already accepts list[MessageParam], so extending to multi-turn means adding a
conversation_history field to ChatRequest and passing it through here.
"""

import json
import uuid
from typing import AsyncIterator, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.services.generation.claude import ClaudeClient, ClaudeModel
from backend.services.generation.prompts import RAG_QA_V1, PromptTemplate
from backend.services.retrieval import RetrievedChunk

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    model: Literal["sonnet", "haiku"] = "sonnet"
    top_k: int = Field(10, ge=1, le=50)
    strategy: Literal["vector", "bm25", "hybrid"] = "hybrid"
    document_ids: list[uuid.UUID] | None = None


class SourceChunk(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_filename: str
    content: str          # Full chunk text — used by UI to render source cards
    score: float
    chunk_index: int
    page_number: int | None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _register_prompt(db: AsyncSession, template: PromptTemplate) -> None:
    """Ensure this prompt version exists in the prompt_versions table.

    Uses INSERT ... ON CONFLICT DO NOTHING so the first request pays a small
    write cost and subsequent requests are near-zero-cost no-ops.
    """
    await db.execute(
        text(
            """
            INSERT INTO prompt_versions (id, name, version, content, is_active)
            VALUES (gen_random_uuid(), :name, :version, :content, true)
            ON CONFLICT ON CONSTRAINT uq_prompt_name_version DO NOTHING
            """
        ),
        {
            "name": template.name,
            "version": template.version,
            "content": template.system_prompt,
        },
    )


async def _sse_generator(
    chunks: list[RetrievedChunk],
    system_prompt: str,
    user_message: str,
    model: ClaudeModel,
) -> AsyncIterator[str]:
    """Async generator that produces the SSE event stream.

    All DB work is complete before this generator runs — it only calls the
    Anthropic API and formats the output as SSE events.
    """
    # Event 1: sources (before generation — lets UI render cards immediately)
    sources = [
        SourceChunk(
            chunk_id=c.chunk_id,
            document_id=c.document_id,
            document_filename=c.document_filename,
            content=c.content,
            score=c.score,
            chunk_index=c.chunk_index,
            page_number=c.page_number,
        ).model_dump(mode="json")
        for c in chunks
    ]
    yield f"data: {json.dumps({'type': 'sources', 'chunks': sources})}\n\n"

    # Event 2: token (one per streamed text delta)
    client = ClaudeClient()
    async for token in client.stream(
        messages=[{"role": "user", "content": user_message}],
        system=system_prompt,
        model=model,
    ):
        yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"

    # Event 3: done
    yield f"data: {json.dumps({'type': 'done'})}\n\n"


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "",
    summary="RAG chat — streams Claude response via SSE",
    response_class=StreamingResponse,
)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Run the full RAG pipeline and stream the answer as Server-Sent Events.

    Steps performed before streaming begins (synchronous from the client's view):
      1. Embed query with Voyage AI (skipped for bm25 strategy)
      2. Retrieve top_k chunks using the chosen strategy
      3. Register the prompt template in prompt_versions if not already present
      4. Build the prompt from retrieved chunks + query

    The SSE stream then emits:
      - sources event: full chunk data for all retrieved chunks
      - token events: Claude's response, one text delta per event
      - done event: signals stream end

    Connect with EventSource in the browser or any SSE client library.
    """
    template = RAG_QA_V1
    claude_model = ClaudeModel.sonnet if request.model == "sonnet" else ClaudeModel.haiku

    # --- Step 1: embed query (skip for bm25) ---
    query_vector: list[float] | None = None
    if request.strategy in ("vector", "hybrid"):
        from backend.services.ingestion.embedder import VoyageQueryEmbedder
        embedder = VoyageQueryEmbedder()
        vectors = await embedder.embed([request.query])
        query_vector = vectors[0]

    # --- Step 2: retrieve chunks ---
    chunks: list[RetrievedChunk]

    if request.strategy == "vector":
        from backend.services.retrieval.vector import VectorRetriever
        assert query_vector is not None
        chunks = await VectorRetriever().search(
            db, query_vector=query_vector, top_k=request.top_k,
            document_ids=request.document_ids,
        )
    elif request.strategy == "bm25":
        from backend.services.retrieval.bm25 import BM25Retriever
        chunks = await BM25Retriever().search(
            db, query=request.query, top_k=request.top_k,
            document_ids=request.document_ids,
        )
    else:  # hybrid
        from backend.services.retrieval.hybrid import HybridRetriever
        assert query_vector is not None
        chunks = await HybridRetriever().search(
            db, query=request.query, query_vector=query_vector,
            top_k=request.top_k, document_ids=request.document_ids,
        )

    # --- Step 3: register prompt template ---
    await _register_prompt(db, template)

    # --- Step 4: build prompt ---
    user_message = template.render_user_message(chunks, request.query)

    return StreamingResponse(
        _sse_generator(chunks, template.system_prompt, user_message, claude_model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Prevents nginx from buffering the stream
        },
    )
