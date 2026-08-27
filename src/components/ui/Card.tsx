import React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export function Card({
  className,
  title,
  subtitle,
  headerAction,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface/90 border border-border rounded-xl shadow-card flex flex-col transition-colors hover:border-border-strong/80",
        className
      )}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-border/70">
          <div className="flex flex-col min-w-0 gap-0.5">
            {title && (
              <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
            )}
            {subtitle && (
              <p className="text-xs text-subtle leading-snug">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="flex items-center gap-2 shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
