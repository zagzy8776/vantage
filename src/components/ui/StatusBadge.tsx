import React from "react";
import { cn } from "../../lib/utils";
import type { PipelineStage, WebsiteHealth, LeadSource } from "../../lib/types";
import { PIPELINE_STAGE_LABELS } from "../../lib/constants";

export interface StatusBadgeProps {
  type: "stage" | "health" | "source" | "automation" | "custom";
  value: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ type, value, label, className }: StatusBadgeProps) {
  let colorStyle = "bg-surface-2 text-subtle border-border";
  let displayText = label || value;

  if (type === "stage") {
    const stage = value as PipelineStage;
    displayText = label || PIPELINE_STAGE_LABELS[stage] || stage;
    switch (stage) {
      case "discovered":
        colorStyle = "bg-subtle/10 text-muted border-subtle/30";
        break;
      case "analyzing":
        colorStyle = "bg-info/10 text-info border-info/30";
        break;
      case "qualified":
        colorStyle = "bg-warning/10 text-warning border-warning/30";
        break;
      case "contacted":
        colorStyle = "bg-accent/10 text-accent border-accent/30";
        break;
      case "replied":
        colorStyle = "bg-score-high/10 text-score-high border-score-high/30";
        break;
      case "won":
        colorStyle = "bg-success/15 text-success border-success/40 font-semibold";
        break;
    }
  } else if (type === "health") {
    const health = value as WebsiteHealth;
    displayText = label || health.toUpperCase();
    switch (health) {
      case "none":
        colorStyle = "bg-surface-2 text-subtle border-border";
        displayText = "NO WEBSITE";
        break;
      case "unknown":
        colorStyle = "bg-subtle/10 text-subtle border-subtle/30";
        displayText = "UNKNOWN";
        break;
      case "unreachable":
        colorStyle = "bg-danger/10 text-danger border-danger/30";
        displayText = "UNREACHABLE";
        break;
      case "poor":
        colorStyle = "bg-warning/10 text-warning border-warning/30";
        break;
      case "fair":
        colorStyle = "bg-info/10 text-info border-info/30";
        break;
      case "good":
        colorStyle = "bg-success/10 text-success border-success/30";
        break;
    }
  } else if (type === "source") {
    const source = value as LeadSource;
    displayText = label || source.toUpperCase();
    colorStyle = "bg-surface-2 text-muted border-border-strong/40 uppercase tracking-wider text-[10px]";
  } else if (type === "automation") {
    if (value === "active") {
      colorStyle = "bg-success/10 text-success border-success/30";
      displayText = "ACTIVE";
    } else {
      colorStyle = "bg-subtle/10 text-subtle border-border";
      displayText = "PAUSED";
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono font-medium tracking-tight whitespace-nowrap select-none",
        colorStyle,
        className
      )}
    >
      {displayText}
    </span>
  );
}
