"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { InvestigationPlan, InvestigationPlanStepInput } from "@/services/investigations/planning/types";

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide ${className ?? ""}`}>
      {children}
    </span>
  );
}

interface PlanEditStepProps {
  investigationId: string;
  planId?: string;
  onNext: () => void;
  onBack: () => void;
}

export function PlanEditStep({ investigationId, planId, onNext, onBack }: PlanEditStepProps) {
  const [plan, setPlan] = useState<InvestigationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(planId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load plan");
      setPlan(data.plan ?? data);
      if (data.plan?.steps?.length > 0) {
        setSelectedStepId(data.plan.steps[0].id);
      }
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

  const handleSave = async () => {
    if (!plan || !selectedStepId) return;
    setSaving(true);
    setMessage(null);
    try {
      const step = plan.steps.find((s) => s.id === selectedStepId);
      if (!step) return;

      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(plan.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: [
            {
              id: step.id,
              order: step.order,
              type: step.type,
              title: step.title,
              objective: step.objective,
              reason: step.reason,
              configuration: step.configuration,
              dependencies: step.dependencies,
              budget: step.budget,
              enabled: step.enabled,
            } as InvestigationPlanStepInput,
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save plan");
      setMessage("Plan v2 created");
      await loadPlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Edit Research Plan</h1>
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
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Edit Research Plan</h1>
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

  const selectedStep = plan.steps.find((s) => s.id === selectedStepId);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-extrabold font-mono text-foreground">Edit Research Plan</h1>
          <Badge className="border-warning/30 bg-warning/10 text-warning">v{plan.version}</Badge>
        </div>
        <p className="text-sm text-subtle">
          Modify plan steps. Saving changes will create a new plan version.
        </p>
      </div>

      {message && (
        <div className="border border-success/30 bg-success/5 text-success rounded px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Steps</h3>
          </div>
          <div className="divide-y divide-border">
            {plan.steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setSelectedStepId(step.id)}
                className={`w-full text-left p-3 transition-colors ${
                  selectedStepId === step.id
                    ? "bg-accent/5 border-l-2 border-accent"
                    : "hover:bg-surface-2 border-l-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-accent">{String(index + 1).padStart(2, "0")}</span>
                  <span className={`text-sm ${selectedStepId === step.id ? "text-foreground font-medium" : "text-muted"}`}>
                    {step.title}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          {selectedStep ? (
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Title</label>
                <Input
                  value={selectedStep.title}
                  onChange={(e) => {
                    setPlan({
                      ...plan,
                      steps: plan.steps.map((s) =>
                        s.id === selectedStep.id ? { ...s, title: e.target.value } : s
                      ),
                    });
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Objective</label>
                <Textarea
                  value={selectedStep.objective}
                  onChange={(e) => {
                    setPlan({
                      ...plan,
                      steps: plan.steps.map((s) =>
                        s.id === selectedStep.id ? { ...s, objective: e.target.value } : s
                      ),
                    });
                  }}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Reason</label>
                <Textarea
                  value={selectedStep.reason}
                  onChange={(e) => {
                    setPlan({
                      ...plan,
                      steps: plan.steps.map((s) =>
                        s.id === selectedStep.id ? { ...s, reason: e.target.value } : s
                      ),
                    });
                  }}
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Providers</label>
                <div className="flex flex-wrap gap-2">
                  {(selectedStep.configuration.providers as string[] | undefined)?.map((provider) => (
                    <Badge key={provider} className="border-border bg-surface-2 text-muted">{provider}</Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Expected Output</label>
                  <Input
                    value={String(selectedStep.configuration.expectedOutput ?? "")}
                    onChange={(e) => {
                      setPlan({
                        ...plan,
                        steps: plan.steps.map((s) =>
                          s.id === selectedStep.id
                            ? {
                                ...s,
                                configuration: { ...s.configuration, expectedOutput: e.target.value },
                              }
                            : s
                        ),
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Budget</label>
                  <Input
                    type="number"
                    value={selectedStep.budget.queries ?? 0}
                    onChange={(e) => {
                      setPlan({
                        ...plan,
                        steps: plan.steps.map((s) =>
                          s.id === selectedStep.id
                            ? { ...s, budget: { ...s.budget, queries: parseInt(e.target.value) || 0 } }
                            : s
                        ),
                      });
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <Button onClick={handleSave} isLoading={saving}>
                  Save Step
                </Button>
                <Button variant="secondary" onClick={onNext}>
                  Continue
                </Button>
                <Button variant="ghost" onClick={onBack}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-subtle">Select a step to edit</div>
          )}
        </Card>
      </div>

      {error && (
        <div className="border border-danger/30 bg-danger/5 text-danger rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
