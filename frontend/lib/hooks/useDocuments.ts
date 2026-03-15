"use client";

import useSWR, { type KeyedMutator } from "swr";
import { listDocuments } from "@/lib/api";
import type { DocumentListItem } from "@/lib/types";

interface UseDocumentsResult {
  documents: DocumentListItem[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<DocumentListItem[]>;
}

/**
 * SWR hook for the document list.
 * Polls every 3s when any document is pending or processing.
 * Stops polling when all documents are in a terminal state.
 */
export function useDocuments(params?: {
  limit?: number;
  offset?: number;
}): UseDocumentsResult {
  const key = ["/api/v1/documents", params?.limit, params?.offset];

  const { data, error, isLoading, mutate } = useSWR<DocumentListItem[]>(
    key,
    () => listDocuments({ limit: params?.limit, offset: params?.offset }),
    {
      refreshInterval(data) {
        const hasInFlight = data?.some(
          (d) => d.status === "pending" || d.status === "processing",
        );
        return hasInFlight ? 3000 : 0;
      },
    },
  );

  return { documents: data, isLoading, error, mutate };
}
