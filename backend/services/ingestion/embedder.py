"""Pluggable embedding strategies.

All embedders implement BaseEmbedder. The model name and version are stored
on every Embedding row so you can always trace which model produced a vector.

Phase 3 implements VoyageEmbedder (voyage-3, 1024 dimensions).
When adding a new embedder: subclass BaseEmbedder, set model_name/version,
implement embed(). No other code needs to change.
"""

import asyncio
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class EmbeddingError(Exception):
    """Raised when embedding fails after retries."""


class BaseEmbedder(ABC):
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Model identifier, e.g. 'voyage-3'. Stored in embeddings table."""
        ...

    @property
    @abstractmethod
    def model_version(self) -> str:
        """Version string stored in embeddings.embedding_model_version."""
        ...

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of texts. Returns one vector per text, in order."""
        ...


class VoyageEmbedder(BaseEmbedder):
    """Voyage AI embedder using the voyage-3 model (1024 dimensions).

    Batches requests to stay well under Voyage's 128-text-per-request limit.
    Implements simple exponential backoff on rate limit errors.

    input_type="document" is used here for indexing. The retrieval service
    must use input_type="query" when embedding search queries (Phase 4).
    """

    model_name: str = "voyage-3"
    model_version: str = "1"
    BATCH_SIZE: int = 32        # Conservative batch size; Voyage allows up to 128
    INPUT_TYPE: str = "document"
    MAX_RETRIES: int = 3
    RETRY_BASE_DELAY: float = 1.0  # seconds; doubles on each retry

    def __init__(self) -> None:
        import voyageai
        from backend.core.config import settings
        self._client = voyageai.AsyncClient(api_key=settings.voyage_api_key)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed texts in batches, with retry on rate limit errors."""
        if not texts:
            return []

        all_vectors: list[list[float]] = []

        for batch_start in range(0, len(texts), self.BATCH_SIZE):
            batch = texts[batch_start : batch_start + self.BATCH_SIZE]
            vectors = await self._embed_batch_with_retry(batch, batch_start)
            all_vectors.extend(vectors)

        return all_vectors

    async def _embed_batch_with_retry(
        self,
        batch: list[str],
        batch_start: int,
    ) -> list[list[float]]:
        import voyageai

        delay = self.RETRY_BASE_DELAY
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                result = await self._client.embed(
                    batch,
                    model=self.model_name,
                    input_type=self.INPUT_TYPE,
                )
                return result.embeddings
            except voyageai.error.RateLimitError:
                if attempt == self.MAX_RETRIES:
                    raise EmbeddingError(
                        f"Voyage rate limit exceeded after {self.MAX_RETRIES} retries "
                        f"on batch starting at index {batch_start}"
                    )
                logger.warning(
                    "Voyage rate limit hit (attempt %d/%d), retrying in %.1fs",
                    attempt,
                    self.MAX_RETRIES,
                    delay,
                )
                await asyncio.sleep(delay)
                delay *= 2  # Exponential backoff

        # Unreachable, but satisfies the type checker
        raise EmbeddingError("Embedding failed unexpectedly")
