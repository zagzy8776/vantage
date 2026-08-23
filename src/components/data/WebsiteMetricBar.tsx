import React from "react";
import { cn } from "../../lib/utils";

export interface WebsiteMetricBarProps {
  label: string;
  value: number;
  max?: number;
  color?: "muted" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function WebsiteMetricBar({
  label,
  value,
  max = 100,
  color = "muted",
  className,
}: WebsiteMetricBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const colorClasses = {
    muted: "bg-subtle",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
  };

  const labelColor = {
    muted: "text-subtle",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    info: "text-info",
  };

  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      <span className={cn("w-20 sm:w-24 text-xs font-medium", labelColor[color])}>{label}</span>
      <div className="relative flex-1 h-5 bg-surface-2 rounded overflow-hidden">
        <div
          className={cn("h-full rounded transition-all relative", colorClasses[color], value < 90 && "bg-info", value < 60 && "bg-warning", value < 30 && "bg-danger")}
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/5" />
        </div>
      </div>
      <span className="tabular w-8 text-right text-subtle">{value}</span>
    </div>
  );
}
