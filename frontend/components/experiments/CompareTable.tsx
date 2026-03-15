import { Badge } from "@/components/ui/badge";
import { GlossaryTooltip } from "@/components/shared/GlossaryTooltip";
import type { ExperimentListItem } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-green-600";
  if (score >= 0.5) return "text-yellow-600";
  return "text-red-600";
}

function Delta({ base, value }: { base: number; value: number }) {
  const diff = value - base;
  if (Math.abs(diff) < 0.001) return <span className="text-muted-foreground text-xs">—</span>;
  const pos = diff > 0;
  return (
    <span className={`text-xs ml-1 ${pos ? "text-green-600" : "text-red-600"}`}>
      {pos ? "+" : ""}{diff.toFixed(2)}
    </span>
  );
}

interface CompareTableProps {
  experiments: ExperimentListItem[];
}

export function CompareTable({ experiments }: CompareTableProps) {
  const complete = experiments.filter((e) => e.status === "complete" && e.results);
  if (complete.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Select completed experiments to compare.
      </p>
    );
  }

  const base = complete[0].results!;

  return (
    <div className="overflow-x-auto rounded-md border mt-4">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
            <th className="py-2.5 pl-4 pr-3 font-medium">Name</th>
            <th className="py-2.5 pr-3 font-medium">Strategy</th>
            <th className="py-2.5 pr-3 font-medium">
              <GlossaryTooltip term="faithfulness">Faithfulness</GlossaryTooltip>
            </th>
            <th className="py-2.5 pr-3 font-medium">
              <GlossaryTooltip term="relevance">Relevance</GlossaryTooltip>
            </th>
            <th className="py-2.5 pr-3 font-medium">
              <GlossaryTooltip term="recall">Recall</GlossaryTooltip>
            </th>
            <th className="py-2.5 pr-4 font-medium">Questions</th>
          </tr>
        </thead>
        <tbody>
          {complete.map((exp, i) => {
            const r = exp.results!;
            const isBase = i === 0;
            return (
              <tr key={exp.experiment_id} className="border-b last:border-0">
                <td className="py-2.5 pl-4 pr-3 font-medium max-w-[160px] truncate">
                  {exp.name}
                  {isBase && <Badge variant="outline" className="ml-2 text-xs py-0">base</Badge>}
                </td>
                <td className="py-2.5 pr-3">
                  <Badge variant="outline" className="text-xs font-normal">{exp.retrieval_strategy}</Badge>
                </td>
                <td className="py-2.5 pr-3">
                  <span className={`font-medium tabular-nums ${scoreColor(r.avg_faithfulness)}`}>
                    {r.avg_faithfulness.toFixed(2)}
                  </span>
                  {!isBase && <Delta base={base.avg_faithfulness} value={r.avg_faithfulness} />}
                </td>
                <td className="py-2.5 pr-3">
                  <span className={`font-medium tabular-nums ${scoreColor(r.avg_relevance)}`}>
                    {r.avg_relevance.toFixed(2)}
                  </span>
                  {!isBase && <Delta base={base.avg_relevance} value={r.avg_relevance} />}
                </td>
                <td className="py-2.5 pr-3">
                  <span className={`font-medium tabular-nums ${scoreColor(r.avg_recall)}`}>
                    {r.avg_recall.toFixed(2)}
                  </span>
                  {!isBase && <Delta base={base.avg_recall} value={r.avg_recall} />}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{r.total_questions}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
