"""Document parsing — converts raw file bytes into plain text."""

import asyncio
import io
from dataclasses import dataclass
from functools import partial


class DocumentParseError(Exception):
    """Raised when a document cannot be parsed."""


@dataclass
class ParsedDocument:
    text: str             # Full extracted text (all pages concatenated)
    page_count: int       # Total pages (always 1 for plain text files)
    page_texts: list[str] # Text per page; index 0 = page 1
    mime_type: str


async def parse_document(
    content: bytes,
    mime_type: str,
    filename: str,
) -> ParsedDocument:
    """Parse raw bytes into a ParsedDocument. Dispatches on mime_type."""
    if mime_type == "application/pdf":
        return await _parse_pdf(content)
    elif mime_type in ("text/plain", "text/markdown"):
        return await _parse_text(content, mime_type)
    else:
        raise DocumentParseError(
            f"Unsupported MIME type '{mime_type}' for file '{filename}'. "
            "Supported types: application/pdf, text/plain, text/markdown."
        )


async def _parse_pdf(content: bytes) -> ParsedDocument:
    """Extract text from a PDF using PyMuPDF (CPU-bound, run in executor)."""
    def _extract() -> ParsedDocument:
        try:
            import pymupdf  # noqa: PLC0415 — lazy import; pymupdf is optional for txt-only use
        except ImportError as exc:
            raise DocumentParseError("pymupdf is not installed") from exc

        try:
            doc = pymupdf.open(stream=io.BytesIO(content), filetype="pdf")
        except Exception as exc:
            raise DocumentParseError(f"Failed to open PDF: {exc}") from exc

        page_texts: list[str] = []
        for page in doc.pages():
            page_texts.append(page.get_text("text"))  # type: ignore[union-attr]

        doc.close()

        full_text = "\n".join(page_texts)
        return ParsedDocument(
            text=full_text,
            page_count=len(page_texts),
            page_texts=page_texts,
            mime_type="application/pdf",
        )

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_extract))


async def _parse_text(content: bytes, mime_type: str) -> ParsedDocument:
    """Decode plain text bytes into a ParsedDocument."""
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    return ParsedDocument(
        text=text,
        page_count=1,
        page_texts=[text],
        mime_type=mime_type,
    )
