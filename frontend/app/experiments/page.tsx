"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GenerateDatasetForm } from "@/components/experiments/GenerateDatasetForm";
import { ExperimentTable } from "@/components/experiments/ExperimentTable";
import { CreateRunDialog } from "@/components/experiments/CreateRunDialog";
import { CompareTable } from "@/components/experiments/CompareTable";
import { useExperiments } from "@/lib/hooks/useExperiments";
import { useDocuments } from "@/lib/hooks/useDocuments";

export default function ExperimentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const compareParam = searchParams.get("compare");

  const [datasetFile, setDatasetFile] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [compareMode, setCompareMode] = useState(!!compareParam);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    compareParam ? compareParam.split(",") : [],
  );

  const { experiments, isLoading, mutate } = useExperiments({ limit: 200 });
  const { documents } = useDocuments();
  const readyDocs = documents?.filter((d) => d.status === "ready") ?? [];

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const qs = next.length > 0 ? `?compare=${next.join(",")}` : "/experiments";
      router.replace(qs.startsWith("?") ? `/experiments${qs}` : qs, { scroll: false });
      return next;
    });
  }

  function exitCompare() {
    setCompareMode(false);
    setSelectedIds([]);
    router.replace("/experiments", { scroll: false });
  }

  const compareExperiments =
    experiments?.filter((e) => selectedIds.includes(e.experiment_id)) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Experiments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate evaluation datasets and run retrieval experiments to compare strategies.
        </p>
      </div>

      <GenerateDatasetForm
        readyDocs={readyDocs}
        onDatasetGenerated={setDatasetFile}
      />

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Experiment Runs</h2>
        <div className="flex gap-2">
          {compareMode ? (
            <Button variant="outline" size="sm" onClick={exitCompare}>
              Exit compare
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareMode(true)}
            >
              Compare
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            + New Run
          </Button>
        </div>
      </div>

      <ExperimentTable
        experiments={experiments}
        isLoading={isLoading}
        compareMode={compareMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      {compareMode && selectedIds.length > 0 && (
        <div>
          <h3 className="font-medium mb-1">
            Comparing {selectedIds.length} experiments
          </h3>
          <CompareTable experiments={compareExperiments} />
        </div>
      )}

      <CreateRunDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        datasetFile={datasetFile}
        readyDocs={readyDocs}
        mutate={mutate}
      />
    </div>
  );
}
