"""Alembic environment configuration — async SQLAlchemy."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# ---------------------------------------------------------------------------
# Settings and Base — must be imported before table modules
# ---------------------------------------------------------------------------
from backend.core.config import settings
from backend.models.database import Base

# Import all table modules so their models are registered on Base.metadata.
# Alembic autogenerate only detects tables that have been imported here.
# noqa: F401 — imports are intentional side effects, not unused.
from backend.models.tables import documents, embeddings, experiments, prompts  # noqa: F401

# ---------------------------------------------------------------------------
# Alembic config
# ---------------------------------------------------------------------------
config = context.config

# Override sqlalchemy.url from settings so no secrets are hardcoded in alembic.ini.
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The metadata Alembic diffs against to autogenerate migrations.
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Offline mode — emits SQL to stdout without connecting to the DB
# ---------------------------------------------------------------------------

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online mode — connects to DB and runs migrations
# ---------------------------------------------------------------------------

def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    # NullPool is required for Alembic: migrations are one-shot, not long-lived,
    # so we don't want SQLAlchemy holding open connections between migration steps.
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
