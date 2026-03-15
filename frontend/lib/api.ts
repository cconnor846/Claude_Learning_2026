/**
 * Typed API client for the RAG Platform backend.
 * All fetch calls go through this module — components never call fetch directly.
 */

import type {
  ChatRequest,
  ChunkListResponse,
  CreateExperimentRequest,
  DocumentDetail,
  DocumentListItem,
  DocumentUploadResponse,
  ExperimentDetail,
  ExperimentListItem,
  GenerateDatasetRequest,
  GenerateDatasetResponse,
  SearchRequest,
  SearchResponse,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Base fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const detail = await res
      .json()
      .catch(() => ({ detail: res.statusText })) as { detail?: string };
    throw new ApiError(res.status, detail.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function uploadDocument(
  file: File,
): Promise<DocumentUploadResponse> {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<DocumentUploadResponse>("/api/v1/documents", {
    method: "POST",
    body,
  });
}

export async function listDocuments(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<DocumentListItem[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch<DocumentListItem[]>(`/api/v1/documents${query}`);
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  return apiFetch<DocumentDetail>(`/api/v1/documents/${id}`);
}

export async function listChunks(
  documentId: string,
  params?: { limit?: number; offset?: number },
): Promise<ChunkListResponse> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch<ChunkListResponse>(
    `/api/v1/documents/${documentId}/chunks${query}`,
  );
}

export async function deleteDocument(_id: string): Promise<void> {
  // Not yet implemented in backend — placeholder
  throw new ApiError(501, "Delete not yet implemented");
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function search(request: SearchRequest): Promise<SearchResponse> {
  return apiFetch<SearchResponse>("/api/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

// ---------------------------------------------------------------------------
// Chat — returns a ReadableStream (SSE), not JSON
// ---------------------------------------------------------------------------

export async function chatStream(
  request: ChatRequest,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .catch(() => ({ detail: res.statusText })) as { detail?: string };
    throw new ApiError(res.status, detail.detail ?? res.statusText);
  }
  if (!res.body) {
    throw new ApiError(500, "No response body for chat stream");
  }
  return res.body;
}

// ---------------------------------------------------------------------------
// Evals
// ---------------------------------------------------------------------------

export async function generateDataset(
  request: GenerateDatasetRequest,
): Promise<GenerateDatasetResponse> {
  return apiFetch<GenerateDatasetResponse>("/api/v1/evals/datasets/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function createExperiment(
  request: CreateExperimentRequest,
): Promise<ExperimentListItem> {
  return apiFetch<ExperimentListItem>("/api/v1/evals/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function listExperiments(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ExperimentListItem[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch<ExperimentListItem[]>(`/api/v1/evals/runs${query}`);
}

export async function getExperiment(id: string): Promise<ExperimentDetail> {
  return apiFetch<ExperimentDetail>(`/api/v1/evals/runs/${id}`);
}
