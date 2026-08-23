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
        "bg-surface border border-border rounded-lg p-4 sm:p-5 flex flex-col justify-between transition-all hover:border-border-strong group",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted uppercase tracking-wider">
          {title}
        </p>
        {icon && (
          <div className="p-2 rounded bg-surface-2 text-subtle group-hover:text-accent transition-colors">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-foreground tabular">
          {formattedValue}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-mono font-medium px-1.5 py-0.5 rounded",
              trend.isPositive
                ? "text-success bg-success/10 border border-success/20"
                : "text-muted bg-surface-2 border border-border"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-subtle leading-tight">{subtitle}</p>
      )}
    </div>
  );
}
