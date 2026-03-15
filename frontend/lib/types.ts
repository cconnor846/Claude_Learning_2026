/**
 * All TypeScript interfaces for the RAG Platform frontend.
 * Mirror the Pydantic response models exactly.
 * If a backend field changes, update here first and let TypeScript errors guide fixes.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export type ExperimentStatus = "pending" | "running" | "complete" | "failed";

export type RetrievalStrategy = "vector" | "bm25" | "hybrid";

// Pipeline steps emitted while a document's status is "processing".
export type PipelineStep = "parsing" | "chunking" | "embedding" | "storing";

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface DocumentListItem {
  document_id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  status: DocumentStatus;
  pipeline_step: PipelineStep | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetail extends DocumentListItem {
  chunk_count: number;
}

export interface ChunkItem {
  chunk_id: string;
  chunk_index: number;
  content: string;
  char_count: number;
  chunking_strategy: string;
  page_number: number | null;
  section_title: string | null;
  created_at: string;
}

export interface ChunkListResponse {
  document_id: string;
  total_chunks: number;
  chunks: ChunkItem[];
}

export interface DocumentUploadResponse {
  document_id: string;
  status: DocumentStatus;
  status_url: string;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  document_filename: string;
  chunk_index: number;
  page_number: number | null;
  content: string;
  score: number;
  chunking_strategy: string;
}

export interface SearchRequest {
  query: string;
  strategy: RetrievalStrategy;
  top_k: number;
  document_ids?: string[];
}

export interface SearchResponse {
  query: string;
  strategy: RetrievalStrategy;
  results: RetrievedChunk[];
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatRequest {
  query: string;
  strategy: RetrievalStrategy;
  top_k: number;
  document_ids?: string[];
}

// SSE events parsed from the chat stream
export type SSEEvent =
  | { type: "sources"; chunks: RetrievedChunk[] }
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; detail: string };

// ---------------------------------------------------------------------------
// Evals
// ---------------------------------------------------------------------------

export interface GenerateDatasetRequest {
  document_id: string;
  n_per_chunk: number;
  chunk_limit: number;
}

export interface GenerateDatasetResponse {
  document_id: string;
  pair_count: number;
  dataset_file: string;
}

export interface CreateExperimentRequest {
  name: string;
  description?: string;
  retrieval_strategy: RetrievalStrategy;
  chunking_strategy: string;
  embedding_model: string;
  dataset_file: string;
  top_k: number;
  document_ids?: string[];
}

export interface ExperimentListItem {
  experiment_id: string;
  name: string;
  description: string | null;
  retrieval_strategy: string;
  chunking_strategy: string;
  embedding_model: string;
  status: ExperimentStatus;
  results: ExperimentResults | null;
  created_at: string;
  completed_at: string | null;
}

export interface ExperimentResults {
  total_questions: number;
  avg_faithfulness: number;
  avg_relevance: number;
  avg_recall: number;
}

export interface EvalResultItem {
  result_id: string;
  question: string;
  expected_answer: string;
  generated_answer: string | null;
  source_chunk_id: string | null;
  faithfulness_score: number | null;
  faithfulness_reasoning: string | null;
  relevance_score: number | null;
  relevance_reasoning: string | null;
  recall_score: number | null;
  created_at: string;
}

export interface ExperimentDetail extends ExperimentListItem {
  config: Record<string, unknown>;
  eval_results: EvalResultItem[];
}
