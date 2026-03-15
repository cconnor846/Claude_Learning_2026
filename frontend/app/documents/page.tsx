"use client";

import { useState } from "react";
import { UploadZone } from "@/components/documents/UploadZone";
import { DocumentTable } from "@/components/documents/DocumentTable";
import { DocumentDrawer } from "@/components/documents/DocumentDrawer";
import { useDocuments } from "@/lib/hooks/useDocuments";
import type { DocumentListItem } from "@/lib/types";

export default function DocumentsPage() {
  const { documents, isLoading, mutate } = useDocuments({ limit: 200 });
  const [inspecting, setInspecting] = useState<DocumentListItem | null>(null);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload documents to ingest them into the RAG pipeline.
        </p>
      </div>

      <UploadZone mutate={mutate} />

      <DocumentTable
        documents={documents}
        isLoading={isLoading}
        mutate={mutate}
        onInspect={setInspecting}
      />

      <DocumentDrawer
        document={inspecting}
        open={!!inspecting}
        onClose={() => setInspecting(null)}
      />
    </div>
  );
}
