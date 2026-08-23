import React from "react";
import { cn } from "../../lib/utils";

export interface LoadingStateProps {
  message?: string;
  rows?: number;
  type?: "spinner" | "skeleton";
  className?: string;
}

export function LoadingState({
  message = "Loading high-density intelligence data...",
  rows = 4,
  type = "skeleton",
  className,
}: LoadingStateProps) {
  if (type === "spinner") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-12 text-center",
          className
        )}
      >
        <svg
          className="animate-spin h-8 w-8 text-accent mb-3"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-xs text-muted font-mono tracking-tight">{message}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 w-full p-4 animate-pulse", className)}>
      <div className="h-4 bg-surface-2 rounded w-1/4"></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-surface-2/60 rounded w-full"></div>
      ))}
    </div>
  );
}
