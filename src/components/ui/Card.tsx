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
        "bg-surface border border-border rounded-lg shadow-card flex flex-col transition-all",
        className
      )}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface-2/30">
          <div className="flex flex-col min-w-0">
            {title && (
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-subtle mt-0.5 leading-tight truncate">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="flex items-center gap-2 shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
