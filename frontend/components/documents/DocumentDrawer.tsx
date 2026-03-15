"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ChunkInspector } from "@/components/documents/ChunkInspector";
import type { DocumentListItem } from "@/lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

interface DocumentDrawerProps {
  document: DocumentListItem | null;
  open: boolean;
  onClose: () => void;
}

export function DocumentDrawer({ document: doc, open, onClose }: DocumentDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-2/3 max-w-2xl overflow-y-auto">
        {doc && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2 truncate">
                <span className="truncate">{doc.original_filename}</span>
                <StatusBadge
                  status={doc.status}
                  errorMessage={doc.error_message}
                />
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{doc.mime_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size</span>
                <span>{formatBytes(doc.file_size_bytes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uploaded</span>
                <span>{formatDate(doc.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{formatDate(doc.updated_at)}</span>
              </div>
            </div>

            <Separator className="my-4" />

            {doc.status === "ready" ? (
              <>
                <h3 className="mb-3 text-sm font-semibold">Chunks</h3>
                <ChunkInspector documentId={doc.document_id} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Chunks available after ingestion completes.
              </p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
