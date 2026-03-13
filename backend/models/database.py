"""SQLAlchemy 2.0 async engine, session factory, and declarative Base."""

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from backend.core.config import settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
# echo=True in development prints every SQL statement — useful for learning.
# pool_pre_ping=True issues a cheap ping before reusing a connection, which
# prevents "connection already closed" errors after postgres restarts.

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
# async_sessionmaker is the SQLAlchemy 2.0 replacement for sessionmaker.
# expire_on_commit=False is non-negotiable in async FastAPI: without it,
# accessing attributes after a commit triggers a DB round-trip outside
# an active session, causing MissingGreenlet errors.

async_session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
