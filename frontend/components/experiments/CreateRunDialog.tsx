"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createExperiment } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import type { KeyedMutator } from "swr";
import type { DocumentListItem, ExperimentListItem, RetrievalStrategy } from "@/lib/types";

interface CreateRunDialogProps {
  open: boolean;
  onClose: () => void;
  datasetFile: string;
  readyDocs: DocumentListItem[];
  mutate: KeyedMutator<ExperimentListItem[]>;
}

export function CreateRunDialog({
  open,
  onClose,
  datasetFile,
  readyDocs,
  mutate,
}: CreateRunDialogProps) {
  const [name, setName] = useState("");
  const [dataset, setDataset] = useState(datasetFile);
  const [strategy, setStrategy] = useState<RetrievalStrategy>("hybrid");
  const [topK, setTopK] = useState("5");
  const [chunkingStrategy, setChunkingStrategy] = useState("fixed_size_v1");
  const [embeddingModel, setEmbeddingModel] = useState("voyage-3");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync dataset file when parent updates it
  if (datasetFile && datasetFile !== dataset) setDataset(datasetFile);

  function toggleDoc(id: string) {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  async function handleSubmit() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!dataset.trim()) { toast.error("Dataset file is required"); return; }
    setLoading(true);
    try {
      await createExperiment({
        name: name.trim(),
        retrieval_strategy: strategy,
        chunking_strategy: chunkingStrategy,
        embedding_model: embeddingModel,
        dataset_file: dataset.trim(),
        top_k: Number(topK),
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
      });
      toast.success("Experiment queued");
      await mutate();
      onClose();
      setName("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create experiment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Experiment Run</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. hybrid-top5-voyage3" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Dataset file</Label>
            <Input value={dataset} onChange={(e) => setDataset(e.target.value)} placeholder="e.g. abc123_1741968000.json" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs">Retrieval strategy</Label>
              <Select value={strategy} onValueChange={(v) => setStrategy(v as RetrievalStrategy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="vector">Vector</SelectItem>
                  <SelectItem value="bm25">BM25</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Top-k</Label>
              <Input type="number" min={1} max={50} value={topK} onChange={(e) => setTopK(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs">Chunking strategy</Label>
              <Input value={chunkingStrategy} onChange={(e) => setChunkingStrategy(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Embedding model</Label>
              <Input value={embeddingModel} onChange={(e) => setEmbeddingModel(e.target.value)} />
            </div>
          </div>
          {readyDocs.length > 0 && (
            <div>
              <Label className="mb-1 block text-xs">Document filter (optional — leave empty for all)</Label>
              <ScrollArea className="h-28 rounded border p-2">
                <div className="space-y-1">
                  {readyDocs.map((d) => (
                    <div key={d.document_id} className="flex items-center gap-2">
                      <Checkbox
                        id={`run-doc-${d.document_id}`}
                        checked={selectedDocIds.includes(d.document_id)}
                        onCheckedChange={() => toggleDoc(d.document_id)}
                      />
                      <Label htmlFor={`run-doc-${d.document_id}`} className="text-xs cursor-pointer truncate">
                        {d.original_filename}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating…" : "Create run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
