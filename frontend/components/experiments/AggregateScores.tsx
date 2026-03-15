import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GlossaryTooltip } from "@/components/shared/GlossaryTooltip";
import type { ExperimentResults } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-green-600";
  if (score >= 0.5) return "text-yellow-600";
  return "text-red-600";
}

interface AggregateScoresProps {
  results: ExperimentResults | null | undefined;
  isLoading: boolean;
}

export function AggregateScores({ results, isLoading }: AggregateScoresProps) {
  const tiles = [
    { label: "Faithfulness", glossary: "faithfulness", value: results?.avg_faithfulness },
    { label: "Relevance", glossary: "relevance", value: results?.avg_relevance },
    { label: "Recall", glossary: "recall", value: results?.avg_recall },
    { label: "Questions", glossary: null, value: results?.total_questions, isCount: true },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="p-4">
          <p className="text-xs text-muted-foreground mb-1">
            {tile.glossary ? (
              <GlossaryTooltip term={tile.glossary}>{tile.label}</GlossaryTooltip>
            ) : tile.label}
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : tile.value == null ? (
            <p className="text-2xl font-semibold text-muted-foreground">—</p>
          ) : tile.isCount ? (
            <p className="text-2xl font-semibold tabular-nums">{tile.value}</p>
          ) : (
            <p className={`text-2xl font-semibold tabular-nums ${scoreColor(tile.value as number)}`}>
              {(tile.value as number).toFixed(2)}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
