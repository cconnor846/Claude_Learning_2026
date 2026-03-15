"""add_pipeline_step_and_judge_reasoning

Revision ID: b7d3f1a92e05
Revises: a4f2e8c19d3b
Create Date: 2026-03-15 10:00:00.000000

P1: adds pipeline_step to documents — tracks active ingestion step while
    status=processing, so the frontend can show a step-by-step progress
    indicator rather than a generic spinner.

P2: adds faithfulness_reasoning and relevance_reasoning to eval_results —
    stores the LLM-as-judge's one-sentence explanation alongside each score
    so users can understand why a score was given.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b7d3f1a92e05"
down_revision = "a4f2e8c19d3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # P1 — pipeline step tracker on documents
    op.add_column(
        "documents",
        sa.Column("pipeline_step", sa.String(length=64), nullable=True),
    )

    # P2 — judge reasoning on eval_results
    op.add_column(
        "eval_results",
        sa.Column("faithfulness_reasoning", sa.Text(), nullable=True),
    )
    op.add_column(
        "eval_results",
        sa.Column("relevance_reasoning", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("eval_results", "relevance_reasoning")
    op.drop_column("eval_results", "faithfulness_reasoning")
    op.drop_column("documents", "pipeline_step")
