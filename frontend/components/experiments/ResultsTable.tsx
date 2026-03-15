"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GlossaryTooltip } from "@/components/shared/GlossaryTooltip";
import type { EvalResultItem } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-green-600";
  if (score >= 0.5) return "text-yellow-600";
  return "text-red-600";
}

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  return <span className={`tabular-nums font-medium ${scoreColor(score)}`}>{score.toFixed(2)}</span>;
}

function RecallCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  return score >= 1 ? <span className="text-green-600">✓</span> : <span className="text-red-600">✗</span>;
}

function truncate(text: string, n = 80): string {
  return text.length > n ? text.slice(0, n) + "…" : text;
}

function ReasoningBlock({ label, score, reasoning }: { label: string; score: number | null; reasoning: string | null }) {
  if (score == null) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">
        {label}: <span className={scoreColor(score)}>{score.toFixed(2)}</span>
      </p>
      {reasoning && (
        <blockquote className="border-l-2 border-muted pl-3 text-xs italic text-foreground/75 bg-muted/30 rounded-r py-1 pr-2">
          {reasoning}
        </blockquote>
      )}
    </div>
  );
}

function ResultRow({ result }: { result: EvalResultItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b hover:bg-muted/30 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-2 pl-4 pr-3 text-sm max-w-[200px]">
          {truncate(result.question)}
        </td>
        <td className="py-2 pr-3 text-sm text-muted-foreground max-w-[160px]">
          {truncate(result.expected_answer)}
        </td>
        <td className="py-2 pr-3 text-sm text-muted-foreground max-w-[160px]">
          {result.generated_answer ? truncate(result.generated_answer) : "—"}
        </td>
        <td className="py-2 pr-3"><ScoreCell score={result.faithfulness_score} /></td>
        <td className="py-2 pr-3"><ScoreCell score={result.relevance_score} /></td>
        <td className="py-2 pr-4"><RecallCell score={result.recall_score} /></td>
      </tr>
      {expanded && (
        <tr className="border-b bg-muted/10">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Question</p>
                <p className="text-sm">{result.question}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Expected answer</p>
                  <p className="text-sm text-foreground/80">{result.expected_answer}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Generated answer</p>
                  <p className="text-sm text-foreground/80">{result.generated_answer ?? "—"}</p>
                </div>
              </div>
              <div className="space-y-3">
                <ReasoningBlock
                  label="Faithfulness"
                  score={result.faithfulness_score}
                  reasoning={result.faithfulness_reasoning}
                />
                <ReasoningBlock
                  label="Relevance"
                  score={result.relevance_score}
                  reasoning={result.relevance_reasoning}
                />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Recall: {result.recall_score != null ? (result.recall_score >= 1 ? "✓ Source chunk was retrieved" : "✗ Source chunk was not in top-k results") : "—"}
                  </p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

interface ResultsTableProps {
  results: EvalResultItem[];
}

export function ResultsTable({ results }: ResultsTableProps) {
  return (
    <Tabs defaultValue="results">
      <TabsList>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="raw">Raw</TabsTrigger>
      </TabsList>

      <TabsContent value="results">
        <div className="overflow-x-auto rounded-md border mt-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3 font-medium">Question</th>
                <th className="py-2.5 pr-3 font-medium">Expected</th>
                <th className="py-2.5 pr-3 font-medium">Generated</th>
                <th className="py-2.5 pr-3 font-medium">
                  <GlossaryTooltip term="faithfulness">Faithful</GlossaryTooltip>
                </th>
                <th className="py-2.5 pr-3 font-medium">
                  <GlossaryTooltip term="relevance">Relevant</GlossaryTooltip>
                </th>
                <th className="py-2.5 pr-4 font-medium">
                  <GlossaryTooltip term="recall">Recall</GlossaryTooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <ResultRow key={r.result_id} result={r} />
              ))}
            </tbody>
          </table>
        </div>
      </TabsContent>

      <TabsContent value="raw">
        <ScrollArea className="h-[500px] mt-2 rounded-md border">
          <pre className="p-4 text-xs leading-relaxed">
            {JSON.stringify(results, null, 2)}
          </pre>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
