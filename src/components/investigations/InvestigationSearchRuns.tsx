"use client";

import React from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { InvestigationRunSummary } from "@/services/investigations/types";

export interface InvestigationSearchRunsProps {
  runs: InvestigationRunSummary[];
}

export function InvestigationSearchRuns({ runs }: InvestigationSearchRunsProps) {
  if (runs.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 text-center">
        <h3 className="text-sm font-semibold text-foreground">No search runs attached</h3>
        <p className="text-xs text-subtle mt-1.5">This investigation has no contributing search runs.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {runs.map((run) => (
          <div key={run.id} className="bg-surface border border-border rounded-lg p-4 shadow-card">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide ${run.status === "completed" ? "bg-success/10 text-success border-success/30" : run.status === "completed_with_errors" ? "bg-warning/10 text-warning border-warning/30" : "bg-danger/10 text-danger border-danger/30"}`}>{run.status.replace(/_/g, " ")}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide bg-surface-2 text-muted border-border-strong/40">{run.role.replace(/_/g, " ")}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide bg-surface-2 text-subtle border-border">{run.depth}</span>
              </div>
              <div className="text-sm text-foreground font-medium truncate">{run.query}</div>
              <div className="text-[11px] font-mono text-subtle mt-0.5">
                {[run.city, run.country].filter(Boolean).join(", ")} · {formatDate(String(run.completedAt ?? run.attachedAt))}
                {typeof run.durationMs === "number" && run.durationMs > 0 ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ""}
              </div>
            </div>
            <div className="flex gap-4 text-[11px] font-mono text-subtle shrink-0">
              <span>{run.discoveredCount} businesses</span>
              <span>{run.evidenceItemsGenerated} evidence</span>
              <span className="max-w-[160px] truncate" title={(run.providers ?? []).join(", ")}>{(run.providers ?? []).length > 0 ? (run.providers ?? []).join(", ") : "providers n/a"}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between gap-3 text-[10px] font-mono text-subtle"><span>Run ID: <span className="text-muted">{run.id}</span></span><Link href={`/discover/runs/${encodeURIComponent(run.id)}`} className="text-accent hover:underline">Open diagnostics →</Link></div>
        </div>
      ))}
    </div>
  );
}
