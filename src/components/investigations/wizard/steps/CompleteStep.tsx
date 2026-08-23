"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide ${className ?? ""}`}>
      {children}
    </span>
  );
}

interface CompleteStepProps {
  investigationId: string;
  onNext: () => void;
  onBack: () => void;
}

export function CompleteStep({ investigationId, onNext, onBack }: CompleteStepProps) {
  const [detail, setDetail] = useState<{
    status: string;
    title: string;
    metrics: { businesses: number; evidence: number; findings: number; opportunities: number };
    failures?: Array<{ provider: string; step: string; failureCategory: string; impact: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load investigation");
      setDetail({
        status: data.status,
        title: data.title,
        metrics: data.metrics,
        failures: data.failures,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load investigation");
    } finally {
      setLoading(false);
    }
  }, [investigationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time detail fetch
    void loadDetail();
  }, [loadDetail]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Investigation Completed</h1>
          <p className="text-sm text-subtle mt-1">Loading...</p>
        </div>
        <Card><div className="h-48 animate-pulse bg-surface-2 rounded" /></Card>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Investigation Completed</h1>
        </div>
        <Card>
          <div className="text-center py-8">
            <p className="text-danger text-sm mb-4">{error ?? "Investigation not found"}</p>
            <Button variant="secondary" onClick={loadDetail}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  const isCompletedWithErrors = detail.status === "completed_with_errors";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Investigation Completed</h1>
          <Badge className={isCompletedWithErrors ? "border-warning/30 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}>
            {detail.status.replace(/_/g, " ").toUpperCase()}
          </Badge>
        </div>
        <p className="text-sm text-subtle">
          {isCompletedWithErrors
            ? "The investigation completed with partial provider failures. Some evidence was unavailable."
            : "The investigation has been completed successfully."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{detail.metrics.businesses}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">Businesses Found</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{detail.metrics.evidence}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">Evidence Collected</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{detail.metrics.findings}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">Findings</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{detail.metrics.opportunities}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">Opportunities</div>
        </Card>
      </div>

      {isCompletedWithErrors && detail.failures && detail.failures.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Provider Failures</h3>
            <div className="space-y-3">
              {detail.failures.map((failure, index) => (
                <div key={index} className="flex items-start justify-between gap-4 p-3 border border-warning/30 bg-warning/5 rounded">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">{failure.provider}</span>
                      <Badge className="border-warning/30 bg-warning/10 text-warning text-[9px]">
                        {failure.failureCategory}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted">{failure.step}</div>
                    <div className="text-xs text-subtle mt-1">{failure.impact}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button size="lg" onClick={onNext}>
          View Full Investigation
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
