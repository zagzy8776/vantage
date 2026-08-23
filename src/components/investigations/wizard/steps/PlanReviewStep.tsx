"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { InvestigationPlan } from "@/services/investigations/planning/types";

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide ${className ?? ""}`}>
      {children}
    </span>
  );
}

interface PlanReviewStepProps {
  investigationId: string;
  planId?: string;
  onNext: () => void;
  onBack: () => void;
  onEdit: () => void;
}

export function PlanReviewStep({ investigationId, planId, onNext, onBack, onEdit }: PlanReviewStepProps) {
  const [plan, setPlan] = useState<InvestigationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("steps");
  const [approving, setApproving] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(planId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load plan");
      setPlan(data.plan ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plan");
    } finally {
      setLoading(false);
    }
  }, [investigationId, planId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time plan fetch
    void loadPlan();
  }, [loadPlan]);

  const handleApproveAndRun = async () => {
    if (!planId) return;
    setApproving(true);
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(planId)}/approve-and-run`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to approve and run");
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve and run");
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Research Plan v1</h1>
          <p className="text-sm text-subtle mt-1">Loading plan...</p>
        </div>
        <Card><div className="h-64 animate-pulse bg-surface-2 rounded" /></Card>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Research Plan v1</h1>
        </div>
        <Card>
          <div className="text-center py-8">
            <p className="text-danger text-sm mb-4">{error ?? "Plan not found"}</p>
            <Button variant="secondary" onClick={loadPlan}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: "steps", label: "Plan Steps" },
    { id: "questions", label: "Research Questions" },
    { id: "signals", label: "Signals" },
    { id: "budget", label: "Budget" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-extrabold font-mono text-foreground">
              Research Plan v{plan.version}
            </h1>
            <Badge className="border-warning/30 bg-warning/10 text-warning">REVIEW</Badge>
          </div>
          <p className="text-sm text-subtle">
            Review what VANTAGE plans to investigate before any external research runs.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={onEdit}>Edit Plan</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{plan.plannedBudget.candidates}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">Candidates</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{plan.plannedBudget.totalExternalRequests}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">Requests</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{plan.plannedBudget.aiCalls}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">AI Calls</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{plan.plannedBudget.firecrawlPages}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">Firecrawl Pages</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-mono font-bold text-foreground">{plan.plannedBudget.pagespeedAnalyses}</div>
          <div className="text-[10px] uppercase font-mono text-subtle mt-1">PageSpeed Analyses</div>
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

      {activeTab === "steps" && (
        <div className="space-y-3">
          {plan.steps.map((step, index) => (
            <Card key={step.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-lg font-mono font-bold text-accent w-8 shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                    <Badge className="border-border bg-surface-2 text-subtle text-[9px]">
                      {step.type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted leading-relaxed mb-2">{step.reason}</p>
                  <div className="flex flex-wrap gap-3 text-[10px] font-mono text-subtle">
                    {(step.configuration.providers as string[] | undefined)?.length ? (
                      <span>Providers: {(step.configuration.providers as string[]).join(", ")}</span>
                    ) : null}
                    {Object.entries(step.budget).filter(([, v]) => typeof v === "number" && v > 0).length > 0 && (
                      <span>
                        Budget:{" "}
                        {Object.entries(step.budget)
                          .filter(([, v]) => typeof v === "number" && v > 0)
                          .map(([k, v]) => `${k} ${v}`)
                          .join(" · ")}
                      </span>
                    )}
                    {step.dependencies.length > 0 && (
                      <span>Depends on: {step.dependencies.join(", ")}</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "questions" && (
        <Card className="p-6">
          <div className="space-y-3">
            {plan.objectiveSnapshot.criteria?.researchQuestion ? (
              <div className="text-sm text-muted">{String(plan.objectiveSnapshot.criteria.researchQuestion)}</div>
            ) : (
              <p className="text-sm text-subtle">No specific research question defined.</p>
            )}
          </div>
        </Card>
      )}

      {activeTab === "signals" && (
        <Card className="p-6">
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Signals will be collected during execution. Review the plan steps to understand what data will be gathered.
            </p>
          </div>
        </Card>
      )}

      {activeTab === "budget" && (
        <Card className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-subtle">Business Provider Queries</h4>
              <div className="text-2xl font-mono font-bold text-foreground">{plan.plannedBudget.businessProviderQueries}</div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-subtle">Web Searches</h4>
              <div className="text-2xl font-mono font-bold text-foreground">{plan.plannedBudget.webSearchQueries}</div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-subtle">Candidates</h4>
              <div className="text-2xl font-mono font-bold text-foreground">{plan.plannedBudget.candidates}</div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-subtle">Total Requests</h4>
              <div className="text-2xl font-mono font-bold text-foreground">{plan.plannedBudget.totalExternalRequests}</div>
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button size="lg" onClick={handleApproveAndRun} isLoading={approving}>
          Approve & Run Investigation
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>

      {error && (
        <div className="border border-danger/30 bg-danger/5 text-danger rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
