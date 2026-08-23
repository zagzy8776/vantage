import React from "react";
import { cn } from "../../lib/utils";
import { getScoreTier, SCORE_TIER_META } from "../../lib/score";

export interface OpportunityScoreProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  className?: string;
}

export function OpportunityScore({
  score,
  size = "md",
  showLabel = false,
  className,
}: OpportunityScoreProps) {
  const tier = getScoreTier(score);
  const meta = SCORE_TIER_META[tier];

  if (size === "xl") {
    // Large ring design for detail view
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <div className="relative inline-flex items-center justify-center">
          <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r={radius}
              className="stroke-surface-2"
              strokeWidth="7"
              fill="transparent"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              className={cn("transition-all duration-700 ease-out", meta.ring)}
              strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-3xl font-extrabold font-mono tabular", meta.text)}>
              {score}
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-subtle">
              / 100
            </span>
          </div>
        </div>
        {showLabel && (
          <div className="text-center">
            <span
              className={cn(
                "inline-block px-2.5 py-0.5 rounded text-xs font-mono font-semibold uppercase tracking-wider border",
                meta.bg,
                meta.text,
                meta.border
              )}
            >
              {meta.label} Opportunity
            </span>
          </div>
        )}
      </div>
    );
  }

  const sizes = {
    sm: "px-1.5 py-0.5 text-xs font-mono font-semibold",
    md: "px-2.5 py-1 text-sm font-mono font-bold",
    lg: "px-3 py-1.5 text-base font-mono font-bold",
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "rounded border tabular tracking-tight",
          sizes[size],
          meta.bg,
          meta.text,
          meta.border
        )}
      >
        {score}
      </span>
      {showLabel && (
        <span className={cn("text-xs font-medium uppercase tracking-wider", meta.text)}>
          {meta.label}
        </span>
      )}
    </div>
  );
}
