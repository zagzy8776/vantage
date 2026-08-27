import React from "react";
import { cn, formatNumber } from "../../lib/utils";

export interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: StatCardProps) {
  const formattedValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div
      className={cn(
        "bg-surface/90 border border-border rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all hover:border-accent/25 hover:bg-surface",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium text-muted uppercase tracking-[0.12em]">{title}</p>
        {icon && (
          <div className="p-2 rounded-lg bg-surface-2 text-subtle">{icon}</div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-foreground tabular">
          {formattedValue}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-mono font-medium px-1.5 py-0.5 rounded-md",
              trend.isPositive
                ? "text-success bg-success/10 border border-success/20"
                : "text-muted bg-surface-2 border border-border"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-2 text-xs text-subtle leading-snug">{subtitle}</p>}
    </div>
  );
}
