import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DocumentStatus, ExperimentStatus } from "@/lib/types";

type Status = DocumentStatus | ExperimentStatus;

const STATUS_STYLES: Record<Status, string> = {
  pending: "bg-gray-100 text-gray-700 border-gray-200",
  processing: "bg-yellow-100 text-yellow-800 border-yellow-200",
  running: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ready: "bg-green-100 text-green-800 border-green-200",
  complete: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  processing: "Processing",
  running: "Running",
  ready: "Ready",
  complete: "Complete",
  failed: "Failed",
};

interface StatusBadgeProps {
  status: Status;
  errorMessage?: string | null;
}

export function StatusBadge({ status, errorMessage }: StatusBadgeProps) {
  const isAnimated = status === "processing" || status === "running";
  const badge = (
    <Badge
      variant="outline"
      className={`gap-1.5 ${STATUS_STYLES[status]}`}
    >
      {isAnimated && (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-600" />
      )}
      {STATUS_LABELS[status]}
    </Badge>
  );

  if (status === "failed" && errorMessage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm">
          <p>{errorMessage}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
