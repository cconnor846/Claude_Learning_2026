# Import all table models here so SQLAlchemy can resolve all string-based
# relationship() references when it configures mappers at startup.
from backend.models.tables.documents import Document, Chunk  # noqa: F401
from backend.models.tables.embeddings import Embedding  # noqa: F401
from backend.models.tables.experiments import Experiment, EvalResult  # noqa: F401
from backend.models.tables.prompts import PromptVersion  # noqa: F401
