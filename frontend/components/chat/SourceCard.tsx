"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RelativeScoreBar } from "@/components/shared/RelativeScoreBar";
import type { RetrievedChunk } from "@/lib/types";

interface SourceCardProps {
  chunk: RetrievedChunk;
  maxScore: number;
}

export function SourceCard({ chunk, maxScore }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const preview = chunk.content.slice(0, 150);
  const hasMore = chunk.content.length > 150;

  return (
    <Card className="w-64 shrink-0 p-3 text-sm">
      <p className="font-medium truncate text-xs mb-1" title={chunk.document_filename}>
        {chunk.document_filename}
      </p>
      <div className="flex items-center gap-1.5 mb-2">
        <Badge variant="outline" className="text-xs font-normal px-1.5 py-0">
          chunk {chunk.chunk_index}
          {chunk.page_number != null ? ` · p${chunk.page_number}` : ""}
        </Badge>
        <RelativeScoreBar score={chunk.score} maxScore={maxScore} />
      </div>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <p className="text-xs leading-relaxed text-foreground/75">
          {expanded ? chunk.content : preview}
          {!expanded && hasMore && <span className="text-muted-foreground">…</span>}
        </p>
        {hasMore && (
          <CollapsibleTrigger render={<button className="mt-1 text-xs text-primary hover:underline" />}>
            {expanded ? "Show less" : "Show more"}
          </CollapsibleTrigger>
        )}
        <CollapsibleContent />
      </Collapsible>
    </Card>
  );
}
