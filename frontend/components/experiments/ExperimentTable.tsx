"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GlossaryTooltip } from "@/components/shared/GlossaryTooltip";
import type { ExperimentListItem } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-green-600";
  if (score >= 0.5) return "text-yellow-600";
  return "text-red-600";
}

function ScoreCell({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  return <span className={`tabular-nums font-medium ${scoreColor(score)}`}>{score.toFixed(2)}</span>;
}

function recallFraction(avg: number, total: number): string {
  return `${Math.round(avg * total)}/${total}`;
}

interface ExperimentTableProps {
  experiments: ExperimentListItem[] | undefined;
  isLoading: boolean;
  compareMode: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
}

export function ExperimentTable({
  experiments,
  isLoading,
  compareMode,
  selectedIds,
  onToggleSelect,
}: ExperimentTableProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!experiments || experiments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No experiments yet. Generate a dataset and create a run above.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
            {compareMode && <th className="py-2.5 pl-3 pr-2" />}
            <th className="py-2.5 pl-4 pr-3 font-medium">Name</th>
            <th className="py-2.5 pr-3 font-medium">Strategy</th>
            <th className="py-2.5 pr-3 font-medium">Status</th>
            <th className="py-2.5 pr-3 font-medium">
              <GlossaryTooltip term="faithfulness">Faithfulness</GlossaryTooltip>
            </th>
            <th className="py-2.5 pr-3 font-medium">
              <GlossaryTooltip term="relevance">Relevance</GlossaryTooltip>
            </th>
            <th className="py-2.5 pr-3 font-medium">
              <GlossaryTooltip term="recall">Recall</GlossaryTooltip>
            </th>
            <th className="py-2.5 pr-3 font-medium">Questions</th>
            <th className="py-2.5 pr-4 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {experiments.map((exp) => {
            const r = exp.results;
            return (
              <tr
                key={exp.experiment_id}
                className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                onClick={() =>
                  compareMode
                    ? onToggleSelect(exp.experiment_id)
                    : router.push(`/experiments/${exp.experiment_id}`)
                }
              >
                {compareMode && (
                  <td className="py-2.5 pl-3 pr-2">
                    <Checkbox
                      checked={selectedIds.includes(exp.experiment_id)}
                      onCheckedChange={() => onToggleSelect(exp.experiment_id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                <td className="py-2.5 pl-4 pr-3 font-medium max-w-[180px] truncate">{exp.name}</td>
                <td className="py-2.5 pr-3">
                  <Badge variant="outline" className="text-xs font-normal">
                    {exp.retrieval_strategy}
                  </Badge>
                </td>
                <td className="py-2.5 pr-3">
                  <StatusBadge status={exp.status} />
                </td>
                <td className="py-2.5 pr-3"><ScoreCell score={r?.avg_faithfulness} /></td>
                <td className="py-2.5 pr-3"><ScoreCell score={r?.avg_relevance} /></td>
                <td className="py-2.5 pr-3">
                  {r ? (
                    <span className={`tabular-nums font-medium ${scoreColor(r.avg_recall)}`}>
                      {recallFraction(r.avg_recall, r.total_questions)}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                  {r?.total_questions ?? "—"}
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {new Date(exp.created_at).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
