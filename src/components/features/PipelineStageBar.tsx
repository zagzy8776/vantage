"use client";

import React from "react";
import { cn } from "../../lib/utils";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "../../lib/constants";
import type { PipelineStage } from "../../lib/types";

export interface PipelineStageBarProps {
  counts: Partial<Record<PipelineStage, number>>;
  selectedStage?: PipelineStage | "all";
  onSelect?: (stage: PipelineStage | "all") => void;
}

export function PipelineStageBar({
  counts,
  selectedStage = "all",
  onSelect,
}: PipelineStageBarProps) {
  const totalCount = PIPELINE_STAGES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const stages: Array<{ key: PipelineStage | "all"; label: string; count: number }> = [
    { key: "all", label: "All", count: totalCount },
    ...PIPELINE_STAGES.map((s) => ({ key: s, label: PIPELINE_STAGE_LABELS[s], count: counts[s] ?? 0 })),
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
      <p className="text-xs font-medium text-muted uppercase tracking-wider">
        Lead Pipeline
      </p>

      <div className="flex flex-wrap gap-1">
        {stages.map((stage) => {
          const isActive = selectedStage === stage.key;
          const hasCount = stage.count > 0;

          const colorMap: Record<PipelineStage, string> = {
            discovered: "text-subtle",
            analyzing: "text-info",
            qualified: "text-warning",
            contacted: "text-accent",
            replied: "text-score-high",
            won: "text-success",
          };

          const colorClass = stage.key === "all" ? "text-foreground" : (colorMap[stage.key as PipelineStage] || "");

          return (
            <button
              key={stage.key}
              onClick={() => onSelect?.(stage.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded transition-all text-xs font-mono",
                isActive
                  ? "bg-accent/10 border border-accent/30 text-accent font-semibold"
                  : "bg-surface-2 border border-border hover:border-border-strong text-subtle hover:text-foreground"
              )}
            >
              <span className={cn("whitespace-nowrap", !hasCount && "opacity-50", isActive && "text-accent", stage.key !== "all" && colorClass)}>
                {stage.label}
              </span>
              <span className={cn("px-1.5 py-0.25 rounded-full text-[9px] font-mono", isActive ? "bg-accent/20 text-accent" : "bg-surface border border-border text-subtle")}>
                {stage.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
