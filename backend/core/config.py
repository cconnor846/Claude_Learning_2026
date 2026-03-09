from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Anthropic
    anthropic_api_key: str = ""

    # Voyage AI
    voyage_api_key: str = ""

    # PostgreSQL
    postgres_user: str = "rag"
    postgres_password: str = "changeme"
    postgres_db: str = "rag_platform"
    database_url: str = "postgresql+asyncpg://rag:changeme@postgres:5432/rag_platform"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # MinIO
    minio_root_user: str = "minioadmin"
    minio_root_password: str = "changeme"
    minio_endpoint: str = "minio:9000"
    minio_bucket: str = "documents"

    # LangFuse
    langfuse_secret_key: str = ""
    langfuse_public_key: str = ""
    langfuse_host: str = "http://langfuse:3000"

    # App
    environment: str = "development"
    log_level: str = "INFO"


settings = Settings()
