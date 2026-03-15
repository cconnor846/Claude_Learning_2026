interface RelativeScoreBarProps {
  score: number; // absolute score for this chunk
  maxScore: number; // highest score in the current result set
  className?: string;
}

/**
 * Relative score bar — width is proportional to score / maxScore.
 * The top-scoring chunk gets a full bar; all others are shown relative to it.
 * Color follows the standard green/yellow/red scale based on the absolute score.
 */
export function RelativeScoreBar({
  score,
  maxScore,
  className = "",
}: RelativeScoreBarProps) {
  const relPct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const color =
    score >= 0.8
      ? "bg-green-500"
      : score >= 0.5
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${relPct}%` }}
        />
      </div>
      <span
        className={`text-xs font-medium tabular-nums ${
          score >= 0.8
            ? "text-green-600"
            : score >= 0.5
              ? "text-yellow-600"
              : "text-red-600"
        }`}
      >
        {score.toFixed(3)}
      </span>
    </div>
  );
}
