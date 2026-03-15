"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateDataset } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import type { DocumentListItem } from "@/lib/types";

interface GenerateDatasetFormProps {
  readyDocs: DocumentListItem[];
  onDatasetGenerated: (file: string) => void;
}

export function GenerateDatasetForm({
  readyDocs,
  onDatasetGenerated,
}: GenerateDatasetFormProps) {
  const [docId, setDocId] = useState("");
  const [chunkLimit, setChunkLimit] = useState("20");
  const [nPerChunk, setNPerChunk] = useState("1");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ file: string; count: number } | null>(null);

  async function handleGenerate() {
    if (!docId) { toast.error("Select a document"); return; }
    setLoading(true);
    try {
      const res = await generateDataset({
        document_id: docId,
        chunk_limit: Number(chunkLimit),
        n_per_chunk: Number(nPerChunk),
      });
      setResult({ file: res.dataset_file, count: res.pair_count });
      onDatasetGenerated(res.dataset_file);
      toast.success(`Generated ${res.pair_count} QA pairs`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Generate Eval Dataset</h2>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="mb-1 block text-xs">Document</Label>
          <Select value={docId} onValueChange={(v) => { if (v) setDocId(v); }}>
            <SelectTrigger>
              <SelectValue placeholder="Select document…" />
            </SelectTrigger>
            <SelectContent>
              {readyDocs.map((d) => (
                <SelectItem key={d.document_id} value={d.document_id}>
                  {d.original_filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block text-xs">Chunks to sample</Label>
          <Input
            type="number"
            min={1}
            max={200}
            value={chunkLimit}
            onChange={(e) => setChunkLimit(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs">QA pairs per chunk</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={nPerChunk}
            onChange={(e) => setNPerChunk(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <Button onClick={handleGenerate} disabled={loading || !docId}>
          {loading ? "Generating…" : "Generate"}
        </Button>
        {result && (
          <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-1">
            ✓ {result.count} pairs · <code className="text-xs">{result.file}</code>
          </p>
        )}
      </div>
    </Card>
  );
}
