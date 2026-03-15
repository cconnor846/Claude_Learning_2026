"use client";

import useSWR, { type KeyedMutator } from "swr";
import { listExperiments } from "@/lib/api";
import type { ExperimentListItem } from "@/lib/types";

interface UseExperimentsResult {
  experiments: ExperimentListItem[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<ExperimentListItem[]>;
}

/**
 * SWR hook for the experiment list.
 * Polls every 5s when any experiment is pending or running.
 */
export function useExperiments(params?: {
  limit?: number;
  offset?: number;
}): UseExperimentsResult {
  const key = ["/api/v1/evals/runs", params?.limit, params?.offset];

  const { data, error, isLoading, mutate } = useSWR<ExperimentListItem[]>(
    key,
    () => listExperiments({ limit: params?.limit, offset: params?.offset }),
    {
      refreshInterval(data) {
        const hasInFlight = data?.some(
          (e) => e.status === "pending" || e.status === "running",
        );
        return hasInFlight ? 5000 : 0;
      },
    },
  );

  return { experiments: data, isLoading, error, mutate };
}
