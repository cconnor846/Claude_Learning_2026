"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlossaryTooltip } from "@/components/shared/GlossaryTooltip";
import { useChunks } from "@/lib/hooks/useDocument";
import type { ChunkItem } from "@/lib/types";

const CHUNKS_PER_PAGE = 10;
const CHUNK_MAX_CHARS = 1000; // matches FixedSizeChunker chunk_size

function chunkOverlapPreview(a: ChunkItem, b: ChunkItem): number {
  // Best-effort: count chars of a's tail that appear at b's head
  const tail = a.content.slice(-200);
  const head = b.content.slice(0, 200);
  for (let len = Math.min(tail.length, head.length); len >= 20; len--) {
    if (head.startsWith(tail.slice(tail.length - len))) return len;
  }
  return 0;
}

interface ChunkRowProps {
  chunk: ChunkItem;
  nextChunk?: ChunkItem;
}

function ChunkRow({ chunk, nextChunk }: ChunkRowProps) {
  const [expanded, setExpanded] = useState(false);
  const preview = chunk.content.slice(0, 120);
  const hasMore = chunk.content.length > 120;
  const overlapChars = nextChunk ? chunkOverlapPreview(chunk, nextChunk) : 0;
  const charPct = Math.round((chunk.char_count / CHUNK_MAX_CHARS) * 100);

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pl-3 pr-2 text-sm tabular-nums text-muted-foreground">
        {chunk.chunk_index}
      </td>
      <td className="py-2 pr-2 text-sm text-muted-foreground">
        {chunk.page_number ?? "—"}
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-400"
              style={{ width: `${charPct}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {chunk.char_count}
          </span>
        </div>
      </td>
      <td className="py-2 pr-3">
        <GlossaryTooltip term="chunking strategy">
          <Badge variant="outline" className="text-xs font-normal">
            {chunk.chunking_strategy}
          </Badge>
        </GlossaryTooltip>
        {overlapChars > 0 && (
          <GlossaryTooltip term="chunk overlap">
            <Badge
              variant="outline"
              className="ml-1 text-xs font-normal text-muted-foreground"
            >
              ~{overlapChars}c overlap
            </Badge>
          </GlossaryTooltip>
        )}
      </td>
      <td className="py-2 pr-3 text-sm">
        <p className="leading-snug text-foreground/80">
          {expanded ? chunk.content : preview}
          {!expanded && hasMore && (
            <span className="text-muted-foreground">…</span>
          )}
        </p>
        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 text-xs text-primary hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </td>
    </tr>
  );
}

interface ChunkInspectorProps {
  documentId: string;
}

export function ChunkInspector({ documentId }: ChunkInspectorProps) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useChunks(documentId, {
    limit: CHUNKS_PER_PAGE,
    offset: page * CHUNKS_PER_PAGE,
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.chunks.length === 0) {
    return (
      <p className="p-3 text-sm text-muted-foreground">No chunks found.</p>
    );
  }

  const totalPages = Math.ceil(data.total_chunks / CHUNKS_PER_PAGE);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {data.total_chunks} chunks total
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="py-2 pl-3 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">Page</th>
              <th className="py-2 pr-3 font-medium">Chars</th>
              <th className="py-2 pr-3 font-medium">Strategy</th>
              <th className="py-2 pr-3 font-medium">Content</th>
            </tr>
          </thead>
          <tbody>
            {data.chunks.map((chunk, i) => (
              <ChunkRow
                key={chunk.chunk_id}
                chunk={chunk}
                nextChunk={data.chunks[i + 1]}
              />
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
