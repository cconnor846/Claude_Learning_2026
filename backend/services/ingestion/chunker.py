"""Pluggable chunking strategies.

All chunkers implement BaseChunker. The strategy_name is stored on every
Chunk row so experiments using different strategies are always distinguishable.

Phase 3 implements FixedSizeChunker (character-based sliding window).
Token counting is intentionally omitted here — token_count is left null
until a tokeniser is wired in (Phase 4+).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ChunkData:
    """Intermediate representation of a chunk before DB insertion."""
    content: str
    chunk_index: int
    char_count: int
    page_number: int | None
    section_title: str | None
    metadata: dict = field(default_factory=dict)


class BaseChunker(ABC):
    @property
    @abstractmethod
    def strategy_name(self) -> str:
        """Unique identifier for this strategy, e.g. 'fixed_size_v1'.
        Stored in chunks.chunking_strategy — must be stable across runs."""
        ...

    @abstractmethod
    async def chunk(
        self,
        text: str,
        page_texts: list[str],
        metadata: dict,
    ) -> list[ChunkData]:
        """Split text into chunks. page_texts is used to assign page_number."""
        ...


def _find_page_number(char_offset: int, page_texts: list[str]) -> int | None:
    """Return the 1-based page number for a character offset in the full text.

    Works by tracking cumulative character counts across pages. The offset
    is an approximation because pages are joined with newlines — good enough
    for metadata purposes.
    """
    if not page_texts:
        return None
    cumulative = 0
    for page_num, page_text in enumerate(page_texts, start=1):
        cumulative += len(page_text) + 1  # +1 for the joining newline
        if char_offset < cumulative:
            return page_num
    return len(page_texts)  # Clamp to last page for any overshoot


class FixedSizeChunker(BaseChunker):
    """Character-based sliding window chunker.

    Splits the full document text into overlapping chunks of fixed character
    length. Simple, fast, and a strong baseline for experimentation.

    Args:
        chunk_size: Maximum characters per chunk (default: 1000).
        overlap: Characters of overlap between consecutive chunks (default: 200).
                 20% overlap is a standard starting point.
    """

    strategy_name: str = "fixed_size_v1"

    def __init__(
        self,
        chunk_size: int = 1000,
        overlap: int = 200,
    ) -> None:
        if overlap >= chunk_size:
            raise ValueError("overlap must be less than chunk_size")
        self.chunk_size = chunk_size
        self.overlap = overlap

    async def chunk(
        self,
        text: str,
        page_texts: list[str],
        metadata: dict,
    ) -> list[ChunkData]:
        chunks: list[ChunkData] = []
        start = 0
        chunk_index = 0
        stride = self.chunk_size - self.overlap

        while start < len(text):
            end = start + self.chunk_size
            chunk_text = text[start:end].strip()

            if chunk_text:
                chunks.append(ChunkData(
                    content=chunk_text,
                    chunk_index=chunk_index,
                    char_count=len(chunk_text),
                    page_number=_find_page_number(start, page_texts),
                    section_title=None,
                    metadata={
                        **metadata,
                        "strategy": self.strategy_name,
                        "chunk_size": self.chunk_size,
                        "overlap": self.overlap,
                        "char_start": start,
                        "char_end": min(end, len(text)),
                    },
                ))
                chunk_index += 1

            start += stride

        return chunks
