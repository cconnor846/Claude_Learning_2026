"""Celery application configuration."""

from celery import Celery

from backend.core.config import settings

# Do NOT import ORM models or services here — this module is loaded at worker
# startup for task discovery. Heavy imports belong inside the task functions.

celery_app = Celery(
    "rag_platform",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["backend.workers.tasks.ingest"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Move task to STARTED state when a worker picks it up — makes status
    # polling more informative (pending → started → success/failure).
    task_track_started=True,
    # Acknowledge the task only after it completes, not on receipt.
    # If the worker crashes mid-task, the task is re-queued rather than lost.
    task_acks_late=True,
    # One task at a time per worker process. Ingestion tasks load large files
    # into memory — prefetching multiple tasks would cause memory pressure.
    worker_prefetch_multiplier=1,
    task_routes={
        "backend.workers.tasks.ingest.run_ingestion_pipeline": {
            "queue": "ingestion",
        },
    },
)
