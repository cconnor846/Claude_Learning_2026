"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ChunkItem } from "@/lib/types";

interface ChunkCardProps {
  chunk: ChunkItem;
  previewChars?: number;
}

/**
 * Compact chunk content card reused in ChunkInspector and SourceCard.
 * Shows a character preview with collapsible full text.
 */
export function ChunkCard({ chunk, previewChars = 150 }: ChunkCardProps) {
  const [open, setOpen] = useState(false);
  const preview = chunk.content.slice(0, previewChars);
  const hasMore = chunk.content.length > previewChars;

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <p className="leading-relaxed text-foreground/80">
          {open ? chunk.content : preview}
          {!open && hasMore && (
            <span className="text-muted-foreground">…</span>
          )}
        </p>
        {hasMore && (
          <CollapsibleTrigger asChild>
            <button className="mt-1 text-xs text-primary hover:underline focus:outline-none">
              {open ? "Show less" : "Show more"}
            </button>
          </CollapsibleTrigger>
        )}
        <CollapsibleContent />
      </Collapsible>
    </div>
  );
}
