"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { GlossaryTooltip } from "@/components/shared/GlossaryTooltip";
import type { DocumentListItem, RetrievalStrategy } from "@/lib/types";

const STRATEGIES: { value: RetrievalStrategy; label: string; glossaryTerm: string }[] = [
  { value: "hybrid", label: "Hybrid", glossaryTerm: "hybrid search" },
  { value: "vector", label: "Vector", glossaryTerm: "vector search" },
  { value: "bm25", label: "BM25", glossaryTerm: "BM25" },
];

interface ConfigPanelProps {
  strategy: RetrievalStrategy;
  topK: number;
  selectedDocIds: string[];
  readyDocs: DocumentListItem[];
  onStrategyChange: (s: RetrievalStrategy) => void;
  onTopKChange: (k: number) => void;
  onDocToggle: (id: string) => void;
}

export function ConfigPanel({
  strategy,
  topK,
  selectedDocIds,
  readyDocs,
  onStrategyChange,
  onTopKChange,
  onDocToggle,
}: ConfigPanelProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-5 border-r bg-muted/20 p-4">
      <div>
        <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Retrieval Strategy
        </Label>
        <RadioGroup
          value={strategy}
          onValueChange={(v) => onStrategyChange(v as RetrievalStrategy)}
          className="space-y-1.5"
        >
          {STRATEGIES.map((s) => (
            <div key={s.value} className="flex items-center gap-2">
              <RadioGroupItem value={s.value} id={`strategy-${s.value}`} />
              <Label htmlFor={`strategy-${s.value}`} className="cursor-pointer">
                <GlossaryTooltip term={s.glossaryTerm}>{s.label}</GlossaryTooltip>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <GlossaryTooltip term="top-k">Top-K</GlossaryTooltip>
          </Label>
          <span className="text-sm font-medium tabular-nums">{topK}</span>
        </div>
        <Slider
          min={1}
          max={20}
          step={1}
          value={[topK]}
          onValueChange={(v) => onTopKChange(Array.isArray(v) ? v[0] : v)}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>20</span>
        </div>
      </div>

      <Separator />

      <div className="min-h-0 flex-1">
        <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Documents
        </Label>
        {readyDocs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No ready documents. Upload and ingest a document first.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {selectedDocIds.length === 0
                ? "All documents (none selected)"
                : `${selectedDocIds.length} selected`}
            </p>
            <ScrollArea className="h-48">
              <div className="space-y-1.5 pr-2">
                {readyDocs.map((doc) => (
                  <div key={doc.document_id} className="flex items-start gap-2">
                    <Checkbox
                      id={`doc-${doc.document_id}`}
                      checked={selectedDocIds.includes(doc.document_id)}
                      onCheckedChange={() => onDocToggle(doc.document_id)}
                    />
                    <Label
                      htmlFor={`doc-${doc.document_id}`}
                      className="cursor-pointer truncate text-xs leading-tight"
                      title={doc.original_filename}
                    >
                      {doc.original_filename}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </aside>
  );
}
