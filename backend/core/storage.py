"""MinIO client wrapper — async interface over the synchronous MinIO SDK."""

import asyncio
import io
from functools import partial

import minio
import minio.error

from backend.core.config import settings


class StorageClient:
    """Async wrapper around the MinIO SDK.

    The MinIO Python SDK is synchronous. All blocking calls are offloaded to
    a thread pool via asyncio.get_event_loop().run_in_executor() so the async
    event loop is never blocked.
    """

    def __init__(self) -> None:
        self._client = minio.Minio(
            endpoint=settings.minio_endpoint,
            access_key=settings.minio_root_user,
            secret_key=settings.minio_root_password,
            secure=False,  # HTTP inside Docker — no TLS on internal network
        )
        self._bucket = settings.minio_bucket

    async def _run(self, func, *args, **kwargs):  # type: ignore[no-untyped-def]
        """Run a synchronous callable in the default thread pool executor."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(func, *args, **kwargs))

    async def ensure_bucket(self) -> None:
        """Create the documents bucket if it does not already exist."""
        def _ensure() -> None:
            try:
                if not self._client.bucket_exists(self._bucket):
                    self._client.make_bucket(self._bucket)
            except minio.error.S3Error as exc:
                # BucketAlreadyOwnedByYou can happen under a race condition —
                # treat it as success since the bucket exists either way.
                if exc.code != "BucketAlreadyOwnedByYou":
                    raise

        await self._run(_ensure)

    async def upload_file(
        self,
        object_key: str,
        data: bytes,
        content_type: str,
    ) -> None:
        """Upload bytes to MinIO at the given object key."""
        def _upload() -> None:
            self._client.put_object(
                bucket_name=self._bucket,
                object_name=object_key,
                data=io.BytesIO(data),
                length=len(data),
                content_type=content_type,
            )

        await self._run(_upload)

    async def download_file(self, object_key: str) -> bytes:
        """Download an object from MinIO and return its raw bytes."""
        def _download() -> bytes:
            response = self._client.get_object(
                bucket_name=self._bucket,
                object_name=object_key,
            )
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()

        return await self._run(_download)


# Module-level singleton — mirrors the settings pattern.
storage = StorageClient()
