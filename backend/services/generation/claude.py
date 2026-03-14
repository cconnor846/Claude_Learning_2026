"""Anthropic Claude SDK wrapper.

Provides a thin async interface over the Anthropic Python SDK.
Two methods are exposed:
  - stream(): async generator yielding text tokens — used by the chat endpoint.
  - complete(): returns the full response string — used by eval tasks (Phase 6).

Model selection is via the ClaudeModel enum. The chat route exposes this
choice to the caller so sonnet vs haiku can be compared experimentally.

Multi-turn note: the messages parameter is list[MessageParam], which is the
Anthropic SDK's native type for conversation history. The chat route currently
passes a single user message, but the wrapper is already multi-turn capable.
When Phase 5 is extended to multi-turn, only the route layer changes.
"""

import enum
from typing import AsyncIterator

from anthropic import AsyncAnthropic
from anthropic.types import MessageParam


class ClaudeModel(str, enum.Enum):
    sonnet = "claude-3-5-sonnet-20241022"
    haiku = "claude-3-5-haiku-20241022"


class ClaudeClient:
    def __init__(self) -> None:
        from backend.core.config import settings
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def stream(
        self,
        messages: list[MessageParam],
        system: str,
        model: ClaudeModel = ClaudeModel.sonnet,
        max_tokens: int = 2048,
    ) -> AsyncIterator[str]:
        """Stream a response token by token.

        Yields each text delta as it arrives from the API. The caller is
        responsible for wrapping these in the appropriate SSE envelope.

        Args:
            messages: Conversation history. For single-turn RAG, pass a list
                      with one user message. For future multi-turn, pass the
                      full history.
            system: The system prompt string (from a PromptTemplate).
            model: Which Claude model to use.
            max_tokens: Hard cap on response length.
        """
        async with self._client.messages.stream(
            model=model.value,
            system=system,
            messages=messages,
            max_tokens=max_tokens,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def complete(
        self,
        messages: list[MessageParam],
        system: str,
        model: ClaudeModel = ClaudeModel.haiku,
        max_tokens: int = 2048,
    ) -> str:
        """Return a complete (non-streaming) response.

        Defaults to haiku — this method is intended for eval and batch tasks
        where latency matters less than cost. Use stream() for user-facing chat.
        """
        response = await self._client.messages.create(
            model=model.value,
            system=system,
            messages=messages,
            max_tokens=max_tokens,
        )
        return response.content[0].text
