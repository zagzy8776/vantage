"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { ExecutionStatusView } from "@/services/investigations/planning/types";

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide ${className ?? ""}`}>
      {children}
    </span>
  );
}

interface ExecutionStepProps {
  investigationId: string;
  planId?: string;
  onNext: () => void;
  onBack: () => void;
}

export function ExecutionStep({ investigationId, planId, onNext, onBack }: ExecutionStepProps) {
  const [statusView, setStatusView] = useState<ExecutionStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ACTIVE_STATUSES = useMemo(() => new Set(["created", "queued", "running"]), []);

  const loadStatus = useCallback(async () => {
    if (!planId) return;
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(planId)}/executions`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load execution");
      const executions = data.executions ?? [];
      const active = executions.find((e: ExecutionStatusView) => ACTIVE_STATUSES.has(e.status));
      if (active) {
        setStatusView(active);
      } else if (executions.length > 0) {
        setStatusView(executions[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load execution");
    } finally {
      setLoading(false);
    }
  }, [investigationId, planId, ACTIVE_STATUSES]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time execution status fetch with polling
    void loadStatus();
    const interval = setInterval(() => {
      void loadStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const progress = statusView
    ? Math.round(
        ((statusView.counts.completed + statusView.counts.failed + statusView.counts.blocked + statusView.counts.cancelled + statusView.counts.skipped) /
          statusView.counts.total) *
          100
      )
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Investigation in Progress</h1>
          <p className="text-sm text-subtle mt-1">Loading execution status...</p>
        </div>
        <Card><div className="h-48 animate-pulse bg-surface-2 rounded" /></Card>
      </div>
    );
  }

  if (error || !statusView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Investigation in Progress</h1>
        </div>
        <Card>
          <div className="text-center py-8">
            <p className="text-subtle text-sm mb-4">{error ?? "No execution found"}</p>
            <Button variant="secondary" onClick={loadStatus}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  const isComplete = !ACTIVE_STATUSES.has(statusView.status);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Investigation in Progress</h1>
          <Badge className={isComplete ? "border-success/30 bg-success/10 text-success" : "border-accent/30 bg-accent/10 text-accent"}>
            {statusView.status.replace(/_/g, " ").toUpperCase()}
          </Badge>
        </div>
        <p className="text-sm text-subtle">
          Research Plan v{planId?.slice(-4) ?? "1"} · Execution {statusView.id.slice(-8)}
        </p>
      </div>

      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progress</span>
            <span className="text-sm font-mono text-accent">{progress}%</span>
          </div>
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </Card>

      {statusView.currentStep && (
        <Card>
          <div className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-2">Current Step</h3>
            <p className="text-lg font-mono text-accent">{statusView.currentStep.title || statusView.currentStep.type.replace(/_/g, " ")}</p>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Provider Activity</h3>
          <div className="space-y-2">
            {statusView.providerUsage.map((provider) => (
              <div key={provider.provider} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                <span className="text-sm text-foreground font-medium">{provider.provider}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">{provider.requests} requests</span>
                  {provider.failures > 0 && (
                    <span className="text-xs text-warning">{provider.failures} failed</span>
                  )}
                  <Badge className={provider.failures > 0 ? "border-warning/30 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}>
                    {provider.failures > 0 ? "Partial" : "Completed"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Budget</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Business Queries", used: statusView.budget.actual.businessProviderQueries, planned: statusView.budget.planned.businessProviderQueries },
              { label: "Web Searches", used: statusView.budget.actual.webSearchQueries, planned: statusView.budget.planned.webSearchQueries },
              { label: "Candidates", used: statusView.budget.actual.candidates, planned: statusView.budget.planned.candidates },
              { label: "Firecrawl", used: statusView.budget.actual.firecrawlPages, planned: statusView.budget.planned.firecrawlPages },
              { label: "PageSpeed", used: statusView.budget.actual.pagespeedAnalyses, planned: statusView.budget.planned.pagespeedAnalyses },
              { label: "AI Calls", used: statusView.budget.actual.aiCalls, planned: statusView.budget.planned.aiCalls },
            ].map((item) => (
              <div key={item.label} className="border border-border rounded p-3">
                <div className="text-[10px] uppercase font-mono text-subtle mb-1">{item.label}</div>
                <div className="text-lg font-mono font-bold text-foreground">
                  {item.used} / {item.planned}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming Steps</h3>
          <div className="space-y-2">
            {statusView.steps
              .filter((s) => s.status === "planned" || s.status === "ready")
              .map((step) => (
                <div key={step.id} className="flex items-center gap-3 text-sm">
                  <Badge className="border-info/30 bg-info/10 text-info text-[9px]">{step.status}</Badge>
                  <span className="font-mono text-accent">{String(step.order).padStart(2, "0")}</span>
                  <span className="text-muted">{step.title || step.type.replace(/_/g, " ")}</span>
                </div>
              ))}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3 pt-4 border-t border-border">
        {isComplete && (
          <Button size="lg" onClick={onNext}>
            View Findings
          </Button>
        )}
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
