"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WebsiteMetricBar } from "@/components/data/WebsiteMetricBar";
import { formatDate, formatDomain } from "@/lib/utils";
import type { WebsiteAnalysisSummary, WebsiteHealth } from "@/lib/types";

export interface WebsiteAnalysisPanelProps {
  businessId: string;
  websiteUrl: string | null;
  websiteStatus: WebsiteHealth;
  initialAnalysis: WebsiteAnalysisSummary | null;
}

export function WebsiteAnalysisPanel({ businessId, websiteUrl, websiteStatus, initialAnalysis }: WebsiteAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<WebsiteAnalysisSummary | null>(initialAnalysis);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(initialAnalysis?.reused ? "Using cached analysis." : null);

  const canAnalyze = Boolean(websiteUrl);

  const metricBars = useMemo(() => {
    const current = analysis;
    return [
      { label: "Performance", value: current?.performanceScore ?? 0 },
      { label: "Accessibility", value: current?.accessibilityScore ?? 0 },
      { label: "Best Practices", value: current?.bestPracticesScore ?? 0 },
      { label: "SEO", value: current?.seoScore ?? 0 },
    ];
  }, [analysis]);

  const handleAnalyze = async (force = false) => {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/websites/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, force }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Website analysis failed.");
      }

      setAnalysis(payload.analysis ?? null);
      setMessage(payload.analysis?.reused ? "Loaded cached analysis." : `Analysis completed at ${formatDate(payload.analysis?.analyzedAt ?? null)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Website analysis failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-lg shadow-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface-2/30">
        <div className="flex flex-col min-w-0">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">Website Intelligence</h3>
          <p className="text-[10px] sm:text-xs text-subtle mt-0.5 leading-tight truncate">Public website evidence and technical analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" isLoading={isLoading} disabled={!canAnalyze} onClick={() => handleAnalyze(false)}>
            Analyze Website
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 gap-2 text-sm">
          <div>
            <div className="text-subtle text-xs uppercase">Website URL</div>
            <div className="font-mono break-all">{websiteUrl ? formatDomain(websiteUrl) : "No website"}</div>
          </div>
          <div>
            <div className="text-subtle text-xs uppercase">Website status</div>
            <StatusBadge type="health" value={analysis?.websiteStatus ?? websiteStatus} />
          </div>
          <div>
            <div className="text-subtle text-xs uppercase">Last analysis</div>
            <div>{formatDate(analysis?.analyzedAt ?? null)}</div>
          </div>
          {analysis?.strategy && (
            <div>
              <div className="text-subtle text-xs uppercase">Strategy</div>
              <div className="font-mono uppercase">{analysis.strategy}</div>
            </div>
          )}
          {analysis?.technicalHealthScore !== undefined && analysis?.technicalHealthScore !== null && (
            <div>
              <div className="text-subtle text-xs uppercase">Technical health</div>
              <div className="font-mono">{analysis.technicalHealthScore} / 100</div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {metricBars.map((metric) => (
            <WebsiteMetricBar key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>

        {analysis?.mobileScore !== undefined || analysis?.desktopScore !== undefined ? (
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="border border-border rounded p-2">
              <div className="text-subtle uppercase">Mobile</div>
              <div>{analysis?.mobileScore ?? "—"}</div>
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-subtle uppercase">Desktop</div>
              <div>{analysis?.desktopScore ?? "—"}</div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="secondary" isLoading={isLoading} disabled={!canAnalyze} onClick={() => handleAnalyze(true)}>
            Force reanalysis
          </Button>
          {message && <span className="text-xs text-success">{message}</span>}
          {error && <span className="text-xs text-danger">{error}</span>}
        </div>
      </div>
    </div>
  );
}