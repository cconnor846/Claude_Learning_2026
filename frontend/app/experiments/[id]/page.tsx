"use client";

import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AggregateScores } from "@/components/experiments/AggregateScores";
import { ResultsTable } from "@/components/experiments/ResultsTable";
import { useExperiment } from "@/lib/hooks/useExperiment";

interface PageProps {
  params: { id: string };
}

export default function ExperimentDetailPage({ params }: PageProps) {
  const { experiment, isLoading, error } = useExperiment(params.id);

  if (error) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        {isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <>
            <h1 className="text-2xl font-semibold">{experiment?.name}</h1>
            {experiment && <StatusBadge status={experiment.status} />}
            {experiment && (
              <Badge variant="outline">{experiment.retrieval_strategy}</Badge>
            )}
          </>
        )}
      </div>

      <AggregateScores results={experiment?.results} isLoading={isLoading} />

      {experiment && (
        <Collapsible>
          <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground">
            Show config ▾
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 rounded-md border bg-muted/30 p-4 text-xs leading-relaxed overflow-x-auto">
              {JSON.stringify(experiment.config, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}

      {experiment?.eval_results && experiment.eval_results.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold">Results</h2>
          <ResultsTable results={experiment.eval_results} />
        </div>
      )}

      {experiment && experiment.eval_results.length === 0 && experiment.status !== "complete" && (
        <p className="text-sm text-muted-foreground">
          Results will appear here once the experiment completes.
        </p>
      )}
    </div>
  );
}
