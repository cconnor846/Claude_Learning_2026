"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GlossaryTooltip } from "@/components/shared/GlossaryTooltip";
import type { RetrievedChunk, RetrievalStrategy } from "@/lib/types";

const STRATEGY_DESCRIPTION: Record<RetrievalStrategy, string> = {
  vector:
    "Chunks were ranked by cosine similarity between your query embedding and document embeddings. Semantically similar chunks score highest even when exact words differ.",
  bm25: "Chunks were ranked by BM25 keyword frequency — no embeddings used. Strong for exact-match queries; fast and fully interpretable.",
  hybrid:
    "Vector and BM25 rankings were fused using Reciprocal Rank Fusion (RRF, k=60). Each chunk's RRF score = 1/(k + vector_rank) + 1/(k + bm25_rank). Both semantic and keyword signals contribute.",
};

interface RetrievalExplainerProps {
  strategy: RetrievalStrategy;
  topK: number;
  chunks: RetrievedChunk[];
}

export function RetrievalExplainer({
  strategy,
  topK,
  chunks,
}: RetrievalExplainerProps) {
  if (chunks.length === 0) return null;

  const scores = chunks.map((c) => c.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 mb-1">
        <span>How retrieval worked</span>
        <span className="text-muted-foreground/50">▾</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-md border bg-muted/30 p-3 text-xs space-y-2">
          <p className="leading-relaxed text-foreground/80">
            <span className="font-medium">
              <GlossaryTooltip term={strategy === "hybrid" ? "hybrid search" : strategy === "bm25" ? "BM25" : "vector search"}>
                {strategy.charAt(0).toUpperCase() + strategy.slice(1)}
              </GlossaryTooltip>
            </span>{" "}
            — {STRATEGY_DESCRIPTION[strategy]}
          </p>

          <div className="flex gap-4 text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{chunks.length}</span> of{" "}
              <GlossaryTooltip term="top-k">top-{topK}</GlossaryTooltip> chunks returned
            </span>
            <span>
              Score range:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {minScore.toFixed(3)}–{maxScore.toFixed(3)}
              </span>
            </span>
          </div>

          {strategy === "hybrid" && (
            <div>
              <p className="mb-1 font-medium text-foreground/70">
                <GlossaryTooltip term="RRF">RRF</GlossaryTooltip> ranking:
              </p>
              <table className="w-full">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left font-medium pb-1">Chunk</th>
                    <th className="text-left font-medium pb-1">RRF Score</th>
                  </tr>
                </thead>
                <tbody>
                  {chunks.slice(0, 5).map((c, i) => (
                    <tr key={c.chunk_id}>
                      <td className="pr-4 py-0.5 text-muted-foreground">
                        #{i + 1} · {c.document_filename.slice(0, 20)}… chunk {c.chunk_index}
                      </td>
                      <td className="tabular-nums">{c.score.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
