"use client";

import useSWR from "swr";
import { getExperiment } from "@/lib/api";
import type { ExperimentDetail } from "@/lib/types";

interface UseExperimentResult {
  experiment: ExperimentDetail | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

/**
 * SWR hook for a single experiment.
 * Polls every 5s while the experiment is running; stops when complete/failed.
 */
export function useExperiment(id: string | null): UseExperimentResult {
  const { data, error, isLoading } = useSWR<ExperimentDetail>(
    id ? `/api/v1/evals/runs/${id}` : null,
    () => getExperiment(id!),
    {
      refreshInterval(data) {
        return data?.status === "pending" || data?.status === "running"
          ? 5000
          : 0;
      },
    },
  );
  return { experiment: data, isLoading, error };
}
