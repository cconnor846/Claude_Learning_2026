"""add_source_chunk_id_to_eval_results

Revision ID: a4f2e8c19d3b
Revises: 3b1fa3c60faa
Create Date: 2026-03-14 10:00:00.000000

Adds source_chunk_id to eval_results so that recall scoring can compare
the ground-truth chunk ID against the retrieved chunk IDs.

FK uses ON DELETE SET NULL — if a chunk is deleted we lose the ground-truth
reference but keep the EvalResult row and its other scores.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a4f2e8c19d3b"
down_revision: Union[str, Sequence[str], None] = "3b1fa3c60faa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "eval_results",
        sa.Column("source_chunk_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_eval_results_source_chunk_id",
        "eval_results",
        "chunks",
        ["source_chunk_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_eval_results_source_chunk_id", "eval_results", type_="foreignkey"
    )
    op.drop_column("eval_results", "source_chunk_id")
