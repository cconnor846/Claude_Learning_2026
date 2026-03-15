interface ScoreBarProps {
  score: number; // 0.0–1.0
  className?: string;
}

/**
 * Absolute score bar — width is proportional to the score itself (0–1).
 * Color follows the standard green/yellow/red scale.
 */
export function ScoreBar({ score, className = "" }: ScoreBarProps) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.8
      ? "bg-green-500"
      : score >= 0.5
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-sm font-medium tabular-nums ${
          score >= 0.8
            ? "text-green-600"
            : score >= 0.5
              ? "text-yellow-600"
              : "text-red-600"
        }`}
      >
        {score.toFixed(2)}
      </span>
    </div>
  );
}
