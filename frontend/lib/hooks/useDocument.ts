"use client";

import useSWR from "swr";
import { getDocument, listChunks } from "@/lib/api";
import type { ChunkListResponse, DocumentDetail } from "@/lib/types";

interface UseDocumentResult {
  document: DocumentDetail | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

interface UseChunksResult {
  data: ChunkListResponse | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

export function useDocument(id: string | null): UseDocumentResult {
  const { data, error, isLoading } = useSWR<DocumentDetail>(
    id ? `/api/v1/documents/${id}` : null,
    () => getDocument(id!),
    {
      refreshInterval(data) {
        // Keep polling while the document is still being processed
        return data?.status === "pending" || data?.status === "processing"
          ? 3000
          : 0;
      },
    },
  );
  return { document: data, isLoading, error };
}

export function useChunks(
  documentId: string | null,
  params?: { limit?: number; offset?: number },
): UseChunksResult {
  const key = documentId
    ? [`/api/v1/documents/${documentId}/chunks`, params?.limit, params?.offset]
    : null;
  const { data, error, isLoading } = useSWR<ChunkListResponse>(
    key,
    () => listChunks(documentId!, params),
  );
  return { data, isLoading, error };
}
