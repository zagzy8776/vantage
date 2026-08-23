"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { InvestigationDetail, InvestigationFinding, InvestigationEvidenceItem } from "@/services/investigations/types";

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide ${className ?? ""}`}>
      {children}
    </span>
  );
}

interface FindingsStepProps {
  investigationId: string;
  onNext: () => void;
  onBack: () => void;
}

export function FindingsStep({ investigationId, onNext, onBack }: FindingsStepProps) {
  const [detail, setDetail] = useState<InvestigationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("findings");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}?includeEvidence=true`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load investigation");
      setDetail(data);
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
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Evidence & Findings</h1>
          <p className="text-sm text-subtle mt-1">Loading...</p>
        </div>
        <Card><div className="h-64 animate-pulse bg-surface-2 rounded" /></Card>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Evidence & Findings</h1>
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

  const tabs = [
    { id: "findings", label: "Findings", count: detail.metrics.findings },
    { id: "evidence", label: "Evidence", count: detail.metrics.evidence },
    { id: "opportunities", label: "Opportunities", count: detail.metrics.opportunities },
    { id: "unknowns", label: "Unknowns", count: detail.metrics.unknowns },
  ];

  const CONFIDENCE_STYLES: Record<string, string> = {
    high: "border-success/30 bg-success/10 text-success",
    medium: "border-warning/30 bg-warning/10 text-warning",
    low: "border-border bg-surface-2 text-subtle",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold font-mono text-foreground">Evidence & Findings</h1>
        <p className="text-sm text-subtle mt-1">
          Review the evidence collected and findings generated during the investigation.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{detail.metrics.businesses}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">Businesses</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{detail.metrics.evidence}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">Evidence</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-success">{detail.metrics.supportedClaims}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">Supported Claims</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{detail.metrics.findings}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">Findings</div>
        </Card>
      </div>

      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-[1px] ${
                activeTab === tab.id
                  ? "text-accent border-accent"
                  : "text-muted hover:text-foreground border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "findings" && (
        <div className="space-y-3">
          {detail.findings.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-subtle">No findings have been generated yet.</p>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {detail.findings.map((finding: InvestigationFinding) => (
                <div
                  key={finding.id}
                  className="text-left bg-surface border border-border rounded-lg p-4 hover:border-accent/40 transition-colors shadow-card"
                >
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge className="border-accent/30 bg-accent/10 text-accent">{finding.findingType.replace(/_/g, " ")}</Badge>
                    <Badge className={finding.status === "supported" ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}>
                      {finding.status.replace(/_/g, " ")}
                    </Badge>
                    {typeof finding.confidence === "number" && (
                      <span className="text-[10px] font-mono text-subtle ml-auto">{finding.confidence}% confidence</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{finding.title}</h3>
                  <p className="text-xs text-subtle mt-1 leading-5 line-clamp-3">{finding.summary}</p>
                  <div className="flex gap-3 mt-3 pt-2.5 border-t border-border text-[10px] font-mono text-subtle">
                    <span>{finding.businessIds.length} businesses</span>
                    <span>{finding.claimIds.length} claims</span>
                    <span>{finding.evidenceIds.length} evidence</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "evidence" && (
        <div className="space-y-3">
          {detail.evidenceItems.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-subtle">No evidence available yet.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {detail.evidenceItems.map((item: InvestigationEvidenceItem) => (
                <div key={item.id} className="bg-surface border border-border rounded-lg shadow-card p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge className={CONFIDENCE_STYLES[item.confidence] ?? CONFIDENCE_STYLES.low}>{item.confidence}</Badge>
                    <Badge className="border-border bg-surface-2 text-subtle">{item.sourceType}</Badge>
                    <Badge className="border-border bg-surface-2 text-subtle">{item.category.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted leading-6">{item.statement}</p>
                  {item.value && <p className="text-xs text-foreground font-mono mt-1 break-all">{item.value}</p>}
                  <div className="mt-2 text-[10px] font-mono text-subtle">
                    {item.sourceUrl ? (
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        Original source →
                      </a>
                    ) : (
                      "No source URL"
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "opportunities" && (
        <div className="space-y-3">
          {detail.opportunities.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-subtle">No opportunities yet.</p>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {detail.opportunities.map((opp) => (
                <Card key={opp.id} className="p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge className="border-warning/30 bg-warning/10 text-warning">HYPOTHESIS</Badge>
                    {typeof opp.confidence === "number" && (
                      <span className="text-[10px] font-mono text-subtle ml-auto">{opp.confidence}%</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{opp.title}</h3>
                  <p className="text-xs text-muted mt-1 leading-5">{opp.statement}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "unknowns" && (
        <Card className="p-6">
          {detail.claims.filter((c) => c.claimType === "unknown").length === 0 ? (
            <p className="text-sm text-subtle">No unknowns recorded.</p>
          ) : (
            <ul className="space-y-2">
              {detail.claims.filter((c) => c.claimType === "unknown").map((claim) => (
                <li key={claim.id} className="text-sm text-muted flex items-start gap-2">
                  <span className="text-info mt-0.5">•</span>
                  {claim.statement}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button size="lg" onClick={onNext}>
          Continue
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
