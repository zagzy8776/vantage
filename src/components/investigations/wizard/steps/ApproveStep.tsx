"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { InvestigationPlan } from "@/services/investigations/planning/types";

interface ApproveStepProps {
  investigationId: string;
  planId?: string;
  onNext: () => void;
  onBack: () => void;
}

export function ApproveStep({ investigationId, planId, onNext, onBack }: ApproveStepProps) {
  const [plan, setPlan] = useState<InvestigationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Approve Research Plan</h1>
          <p className="text-sm text-subtle mt-1">Loading...</p>
        </div>
        <Card><div className="h-48 animate-pulse bg-surface-2 rounded" /></Card>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Approve Research Plan</h1>
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

  const budgetItems = [
    { label: "Business provider queries", used: 0, planned: plan.plannedBudget.businessProviderQueries },
    { label: "Web searches", used: 0, planned: plan.plannedBudget.webSearchQueries },
    { label: "Candidates", used: 0, planned: plan.plannedBudget.candidates },
    { label: "Firecrawl", used: 0, planned: plan.plannedBudget.firecrawlPages },
    { label: "PageSpeed", used: 0, planned: plan.plannedBudget.pagespeedAnalyses },
    { label: "AI calls", used: 0, planned: plan.plannedBudget.aiCalls },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold font-mono text-foreground">Approve Research Plan</h1>
        <p className="text-sm text-subtle mt-1">
          This plan will perform external research after approval.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Investigation Summary</h3>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] uppercase font-mono text-subtle mb-1">Objective</div>
                <div className="text-sm text-muted">{plan.objectiveSnapshot.objective}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono text-subtle mb-1">Type</div>
                <div className="text-sm text-muted">{plan.objectiveSnapshot.investigationType}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono text-subtle mb-1">Industry</div>
                <div className="text-sm text-muted">{plan.objectiveSnapshot.targetIndustry ?? "Not specified"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono text-subtle mb-1">Geography</div>
                <div className="text-sm text-muted">
                  {[plan.objectiveSnapshot.geography.city, plan.objectiveSnapshot.geography.region, plan.objectiveSnapshot.geography.country].filter(Boolean).join(", ") || "Not specified"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono text-subtle mb-1">Plan Version</div>
                <div className="text-sm text-muted">v{plan.version}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Research Budget</h3>
            <div className="space-y-3">
              {budgetItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted">{item.label}</span>
                  <span className="text-sm font-mono text-foreground">
                    {item.used} / {item.planned}
                  </span>
                </div>
              ))}
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Total external requests</span>
                  <span className="text-sm font-mono font-bold text-foreground">
                    {budgetItems.reduce((sum, item) => sum + item.used, 0)} / {budgetItems.reduce((sum, item) => sum + item.planned, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

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
