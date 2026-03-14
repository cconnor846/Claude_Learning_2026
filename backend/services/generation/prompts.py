"""Versioned prompt templates for the RAG pipeline.

Each template is a frozen dataclass with a name, integer version, and system
prompt string. The name + version pair maps to a row in the prompt_versions
table, which is written on first use (see backend/api/routes/chat.py).

Adding a new template:
  1. Define a new PromptTemplate constant below.
  2. Bump the version if changing an existing template's system_prompt —
     the old version must remain to preserve eval reproducibility.
  3. The chat route will register it in prompt_versions automatically on
     the first request that uses it.

Prompt design principles for RAG:
  - Instruct the model to answer only from the provided context.
  - Explicitly tell it to say "I don't know" when context is insufficient —
    this is more useful than a hallucinated answer for eval purposes.
  - Keep instructions short; verbose system prompts reduce effective context space.
"""

from dataclasses import dataclass

from backend.services.retrieval import RetrievedChunk


@dataclass(frozen=True)
class PromptTemplate:
    name: str
    version: int
    system_prompt: str

    def render_user_message(self, chunks: list[RetrievedChunk], query: str) -> str:
        """Build the user-turn message from retrieved chunks and the query.

        Each chunk is labelled with its source document and chunk index so
        the model can reference them in its answer. Chunks are separated by
        a horizontal rule to make boundaries visually clear in the prompt.
        """
        context_blocks = "\n\n---\n\n".join(
            f"[Source {i + 1} — {c.document_filename}, chunk {c.chunk_index}"
            + (f", page {c.page_number}" if c.page_number is not None else "")
            + f"]\n{c.content}"
            for i, c in enumerate(chunks)
        )
        return f"Context:\n\n{context_blocks}\n\n---\n\nQuestion: {query}"


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

RAG_QA_V1 = PromptTemplate(
    name="rag_qa",
    version=1,
    system_prompt=(
        "You are a helpful assistant that answers questions based strictly on "
        "the provided context.\n\n"
        "Rules:\n"
        "- Answer only from the context. Do not use outside knowledge.\n"
        "- If the context does not contain enough information to answer, say "
        'so clearly: "The provided documents do not contain enough information '
        'to answer this question."\n'
        "- Be concise and direct. Avoid unnecessary preamble.\n"
        "- Where relevant, reference which source the information comes from."
    ),
)
