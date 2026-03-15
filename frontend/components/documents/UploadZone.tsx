"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadDocument } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import type { KeyedMutator } from "swr";
import type { DocumentListItem } from "@/lib/types";

const ACCEPTED = ".pdf,.txt,.md";
const MAX_MB = 50;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadZoneProps {
  mutate: KeyedMutator<DocumentListItem[]>;
}

export function UploadZone({ mutate }: UploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_MB} MB limit`);
      return;
    }
    setFile(f);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function onSubmit() {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(file);
      toast.success(`Upload started — "${file.name}" is being ingested`);
      setFile(null);
      await mutate();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-8 transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        {file ? (
          <div className="text-center">
            <p className="font-medium text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatBytes(file.size)}
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Drag and drop a file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              PDF, TXT, MD · up to {MAX_MB} MB
            </p>
          </div>
        )}
      </div>

      {file && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFile(null)}
            disabled={uploading}
          >
            Clear
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}
    </div>
  );
}
