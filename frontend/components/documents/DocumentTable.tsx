"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PipelineStepBadge } from "@/components/documents/PipelineStepBadge";
import { toast } from "sonner";
import { deleteDocument } from "@/lib/api";
import { ApiError } from "@/lib/api";
import type { KeyedMutator } from "swr";
import type { DocumentListItem } from "@/lib/types";

const PAGE_SIZE = 20;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function mimeLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "text/markdown") return "MD";
  if (mime === "text/plain") return "TXT";
  return mime;
}

interface DocumentTableProps {
  documents: DocumentListItem[] | undefined;
  isLoading: boolean;
  mutate: KeyedMutator<DocumentListItem[]>;
  onInspect: (doc: DocumentListItem) => void;
}

export function DocumentTable({
  documents,
  isLoading,
  mutate,
  onInspect,
}: DocumentTableProps) {
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<DocumentListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No documents yet. Upload one above.
      </p>
    );
  }

  const paginated = documents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(documents.length / PAGE_SIZE);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocument(deleteTarget.document_id);
      toast.success(`"${deleteTarget.original_filename}" deleted`);
      await mutate();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast.error(msg);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="py-2.5 pl-4 pr-3 font-medium">Filename</th>
              <th className="py-2.5 pr-3 font-medium">Type</th>
              <th className="py-2.5 pr-3 font-medium">Size</th>
              <th className="py-2.5 pr-3 font-medium">Status</th>
              <th className="py-2.5 pr-3 font-medium">Chunks</th>
              <th className="py-2.5 pr-3 font-medium">Uploaded</th>
              <th className="py-2.5 pr-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((doc) => (
              <tr key={doc.document_id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2.5 pl-4 pr-3 max-w-[200px] truncate font-medium">
                  {doc.original_filename}
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground">
                  {mimeLabel(doc.mime_type)}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                  {formatBytes(doc.file_size_bytes)}
                </td>
                <td className="py-2.5 pr-3">
                  {doc.status === "processing" && doc.pipeline_step ? (
                    <PipelineStepBadge currentStep={doc.pipeline_step} />
                  ) : (
                    <StatusBadge
                      status={doc.status}
                      errorMessage={doc.error_message}
                    />
                  )}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                  {doc.status === "ready" ? "—" : "—"}
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground">
                  {formatDate(doc.created_at)}
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onInspect(doc)}
                    >
                      Inspect
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(doc)}
                    >
                      ✕
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm mt-3">
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

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &ldquo;{deleteTarget?.original_filename}&rdquo; and all its chunks will be permanently deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
