"""FastAPI dependency injection.

Add shared dependencies here (DB session, storage client, etc.)
as each phase is implemented.
"""

# from sqlalchemy.ext.asyncio import AsyncSession
# from backend.models.database import async_session_factory
#
# async def get_db() -> AsyncGenerator[AsyncSession, None]:
#     async with async_session_factory() as session:
#         yield session
