"""RAG evaluation metrics.

Three scorers:

  faithfulness — LLM-as-judge: does the answer contain only information
                 from the retrieved context? Detects hallucination.
                 Returns (score: float, reasoning: str).

  relevance    — LLM-as-judge: is the answer actually responsive to the
                 question? Detects topic drift and non-answers.
                 Returns (score: float, reasoning: str).

  recall       — Pure Python binary: was the ground-truth source chunk
                 present in the top-k retrieved set? Measures retrieval
                 coverage independently of generation quality.
                 Returns float 0.0 or 1.0.

Faithfulness and relevance ask Claude haiku to rate on a 1–5 scale and
provide a one-sentence reasoning. The raw integer is normalised:
score = (rating - 1) / 4, so 1 → 0.0 and 5 → 1.0.
"""

import json
import logging
import re

from backend.services.generation.claude import ClaudeClient, ClaudeModel

logger = logging.getLogger(__name__)

_JUDGE_SYSTEM = (
    "You are an expert evaluator of AI-generated answers. "
    'Respond with valid JSON only, in the format: {"rating": <integer 1-5>, "reasoning": "<one sentence explanation>"}'
)

_FAITHFULNESS_PROMPT = """\
Context:
{context}

Answer:
{answer}

On a scale of 1-5, how faithfully does the answer stick to the provided context?
1 = the answer contains significant information NOT present in the context (hallucination)
5 = every claim in the answer is directly supported by the context

Respond with JSON only:"""

_RELEVANCE_PROMPT = """\
Question:
{question}

Answer:
{answer}

On a scale of 1-5, how relevant and responsive is the answer to the question?
1 = the answer does not address the question at all
5 = the answer directly and completely addresses the question

Respond with JSON only:"""


def _parse_judge_response(raw: str) -> tuple[float, str]:
    """Parse judge JSON response into (normalised_score, reasoning).

    Handles two formats for robustness:
    - New: {"rating": 3, "reasoning": "..."}
    - Fallback: bare integer (legacy / malformed responses)

    Returns (0.0, "") if parsing fails entirely.
    """
    raw = raw.strip()
    try:
        data = json.loads(raw)
        rating = int(data["rating"])
        reasoning: str = str(data.get("reasoning", ""))
        score = (max(1, min(5, rating)) - 1) / 4.0
        return score, reasoning
    except (json.JSONDecodeError, KeyError, ValueError):
        # Fallback: extract first digit 1–5 from raw text
        match = re.search(r"[1-5]", raw)
        if match:
            score = (int(match.group()) - 1) / 4.0
            logger.warning("Judge response was not valid JSON, fell back to digit parse: %r", raw[:100])
            return score, ""
        logger.warning("Could not parse judge response at all: %r", raw[:100])
        return 0.0, ""


async def score_faithfulness(
    context_chunks: list[str],
    generated_answer: str,
) -> tuple[float, str]:
    """LLM-as-judge: does the answer stay within the retrieved context?

    Args:
        context_chunks: The text content of each retrieved chunk.
        generated_answer: The answer produced by the RAG pipeline.

    Returns:
        Tuple of (score, reasoning) where score is in [0.0, 1.0].
    """
    context = "\n\n---\n\n".join(context_chunks)
    prompt = _FAITHFULNESS_PROMPT.format(context=context, answer=generated_answer)
    client = ClaudeClient()
    raw = await client.complete(
        messages=[{"role": "user", "content": prompt}],
        system=_JUDGE_SYSTEM,
        model=ClaudeModel.haiku,
        max_tokens=150,
    )
    return _parse_judge_response(raw)


async def score_relevance(
    question: str,
    generated_answer: str,
) -> tuple[float, str]:
    """LLM-as-judge: is the answer responsive to the question?

    Args:
        question: The original question from the eval dataset.
        generated_answer: The answer produced by the RAG pipeline.

    Returns:
        Tuple of (score, reasoning) where score is in [0.0, 1.0].
    """
    prompt = _RELEVANCE_PROMPT.format(question=question, answer=generated_answer)
    client = ClaudeClient()
    raw = await client.complete(
        messages=[{"role": "user", "content": prompt}],
        system=_JUDGE_SYSTEM,
        model=ClaudeModel.haiku,
        max_tokens=150,
    )
    return _parse_judge_response(raw)


def score_recall(
    source_chunk_id: str,
    retrieved_chunk_ids: list[str],
) -> float:
    """Binary recall: was the ground-truth chunk in the retrieved set?

    Args:
        source_chunk_id: The chunk the QA pair was generated from.
        retrieved_chunk_ids: Chunk IDs returned by the retriever (as strings).

    Returns:
        1.0 if source_chunk_id is in retrieved_chunk_ids, else 0.0.
    """
    return 1.0 if source_chunk_id in retrieved_chunk_ids else 0.0
