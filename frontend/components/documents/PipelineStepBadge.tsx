import type { PipelineStep } from "@/lib/types";

const STEPS: { key: PipelineStep; label: string }[] = [
  { key: "parsing", label: "Parse" },
  { key: "chunking", label: "Chunk" },
  { key: "embedding", label: "Embed" },
  { key: "storing", label: "Store" },
];

const STEP_ORDER: Record<PipelineStep, number> = {
  parsing: 0,
  chunking: 1,
  embedding: 2,
  storing: 3,
};

interface PipelineStepBadgeProps {
  currentStep: PipelineStep;
}

/**
 * Shows the ingestion pipeline as a step sequence.
 * Active step is highlighted; completed steps show a checkmark.
 * Only rendered while document status === "processing".
 */
export function PipelineStepBadge({ currentStep }: PipelineStepBadgeProps) {
  const currentIndex = STEP_ORDER[currentStep];

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                isActive
                  ? "bg-yellow-100 text-yellow-800"
                  : isDone
                    ? "text-muted-foreground"
                    : "text-muted-foreground/40"
              }`}
            >
              {isDone ? (
                <span className="text-green-600">✓</span>
              ) : isActive ? (
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-600" />
              ) : null}
              {step.label}
            </div>
            {i < STEPS.length - 1 && (
              <span className="mx-0.5 text-muted-foreground/30 text-xs">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
