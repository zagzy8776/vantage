"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ExecutionStatusView, InvestigationPlan, InvestigationPlanExecution, InvestigationPlanStepInput } from "@/services/investigations/planning/types";

function Badge({ children, className }: { children: React.ReactNode; className?: string }) { return <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide ${className ?? ""}`}>{children}</span>; }

const statusClass: Record<string, string> = { review: "border-warning/30 bg-warning/10 text-warning", draft: "border-border bg-surface-2 text-subtle", approved: "border-info/30 bg-info/10 text-info", executing: "border-accent/30 bg-accent/10 text-accent", completed: "border-success/30 bg-success/10 text-success", completed_with_errors: "border-warning/30 bg-warning/10 text-warning", failed: "border-danger/30 bg-danger/10 text-danger", cancelled: "border-border bg-surface-2 text-subtle", superseded: "border-border bg-surface-2 text-subtle", queued: "border-info/30 bg-info/10 text-info", running: "border-accent/30 bg-accent/10 text-accent", blocked: "border-warning/30 bg-warning/10 text-warning", skipped: "border-border bg-surface-2 text-subtle" };
const ACTIVE_STATUSES = ["created", "queued", "running"];
const POLL_MS = 4000;

export function ResearchPlanPanel({ investigationId }: { investigationId: string }) {
  const [selected, setSelected] = useState<InvestigationPlan | null>(null);
  const [executions, setExecutions] = useState<InvestigationPlanExecution[]>([]);
  const [statusView, setStatusView] = useState<ExecutionStatusView | null>(null);
  const [watchedId, setWatchedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }, []);

  const load = useCallback(async () => {
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans`, { cache: "no-store" });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Failed to load research plans.");
      const nextPlans = payload.plans as InvestigationPlan[];
      const latest = nextPlans[0] ?? null; setSelected(latest);
      if (latest) {
        const detail = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(latest.id)}`, { cache: "no-store" });
        const detailPayload = await detail.json();
        const nextExecutions = (detailPayload.executions ?? []) as InvestigationPlanExecution[];
        setExecutions(nextExecutions);
        setCategoryDraft(String(latest.steps.find((step) => step.type === "discover_businesses")?.configuration.categories ?? ""));
        const active = nextExecutions.find((execution) => ACTIVE_STATUSES.includes(execution.status));
        if (active && active.id !== watchedId) { setWatchedId(active.id); setStatusView(null); }
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to load research plans."); } finally { setLoading(false); }
  }, [investigationId, watchedId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time plan fetch
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial mount only
  }, [investigationId]);

  useEffect(() => {
    stopPolling();
    if (!watchedId || !selected) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(selected.id)}/executions/${encodeURIComponent(watchedId)}`, { cache: "no-store" });
        const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Failed to load execution status.");
        if (cancelled) return;
        const next = payload.execution as ExecutionStatusView;
        setStatusView(next);
        if (!ACTIVE_STATUSES.includes(next.status)) { stopPolling(); void load(); }
      } catch { /* transient poll errors are retried on the next interval */ }
    };
    void poll();
    pollRef.current = setInterval(() => { void poll(); }, POLL_MS);
    return () => { cancelled = true; stopPolling(); };
  }, [watchedId, selected, investigationId, stopPolling, load]);

  const step = selected?.steps.find((item) => item.type === "discover_businesses");
  const estimatedRequests = selected?.plannedBudget.totalExternalRequests ?? 0;
  const editSteps = useMemo(() => selected?.steps.map((item) => ({ id: item.id, order: item.order, type: item.type, title: item.title, objective: item.objective, reason: item.reason, configuration: item.type === "discover_businesses" ? { ...item.configuration, categories: categoryDraft.split(",").map((value) => value.trim()).filter(Boolean) } : item.configuration, dependencies: item.dependencies, budget: item.budget, enabled: item.enabled })) as InvestigationPlanStepInput[] | undefined, [selected, categoryDraft]);

  const create = async () => { setBusy("create"); try { const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to create plan."); } finally { setBusy(null); } };
  const save = async () => { if (!selected || !editSteps) return; setBusy("save"); try { const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(selected.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ steps: editSteps }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to save plan version."); } finally { setBusy(null); } };
  const approve = async () => { if (!selected) return; setBusy("approve"); try { const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(selected.id)}/approve`, { method: "POST" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to approve plan."); } finally { setBusy(null); } };
  const approveAndRun = async () => {
    if (!selected) return; setBusy("approveAndRun"); setMessage(null);
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(selected.id)}/approve-and-run`, { method: "POST" });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      if (payload.executionId) { setWatchedId(payload.executionId); setStatusView(null); }
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to approve and execute plan."); } finally { setBusy(null); }
  };
  const execute = async () => {
    if (!selected) return; setBusy("execute"); setMessage(null);
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(selected.id)}/execute`, { method: "POST" });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      if (payload.executionId) { setWatchedId(payload.executionId); setStatusView(null); }
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to queue plan execution."); } finally { setBusy(null); }
  };
  const cancel = async () => {
    if (!selected || !watchedId) return; setBusy("cancel");
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(selected.id)}/executions/${encodeURIComponent(watchedId)}/cancel`, { method: "POST" });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      if (payload.execution) setStatusView(payload.execution as ExecutionStatusView);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to request cancellation."); } finally { setBusy(null); }
  };
  const reconcile = async () => {
    if (!selected) return; setBusy("reconcile");
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/plans/${encodeURIComponent(selected.id)}/reconcile`, { method: "POST" });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      if (payload.execution) { setStatusView(payload.execution as ExecutionStatusView); setWatchedId(payload.execution.id); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Reconciliation failed."); } finally { setBusy(null); }
  };

  const renderExecutionCard = (view: ExecutionStatusView) => <Card key={view.id} title={`Execution ${view.id.slice(-8)}`} subtitle={`${view.status.replace(/_/g, " ").toUpperCase()}${view.durationMs !== null ? ` · ${(view.durationMs / 1000).toFixed(1)}s` : ""}`} headerAction={<div className="flex gap-2">{ACTIVE_STATUSES.includes(view.status) ? <Button size="sm" variant="secondary" onClick={cancel} isLoading={busy === "cancel"}>Cancel</Button> : null}<Button size="sm" variant="secondary" onClick={reconcile} isLoading={busy === "reconcile"}>Reconcile</Button></div>}>
    <div className="flex flex-wrap items-center gap-2 mb-3"><Badge className={statusClass[view.status] ?? statusClass.draft}>{view.status.replace(/_/g, " ")}</Badge>{view.cancellationRequested && <Badge className="border-warning/30 bg-warning/10 text-warning">cancelling</Badge>}<span className="text-[10px] font-mono text-subtle">steps {view.counts.completed + view.counts.failed + view.counts.blocked + view.counts.cancelled + view.counts.skipped}/{view.counts.total}</span></div>
    {view.currentStep && <p className="text-xs mb-2"><span className="text-subtle">Current step:</span> <b className="text-foreground">{view.currentStep.title || view.currentStep.type.replace(/_/g, " ")}</b></p>}
    <div className="grid gap-2 sm:grid-cols-4 text-xs mb-3">
      <div className="border border-border rounded p-2"><span className="text-subtle block">Requests used/planned</span><b>{view.budget.actual.totalExternalRequests}/{view.budget.planned.totalExternalRequests}</b></div>
      <div className="border border-border rounded p-2"><span className="text-subtle block">Candidates</span><b>{view.budget.actual.candidates}/{view.budget.planned.candidates}</b></div>
      <div className="border border-border rounded p-2"><span className="text-subtle block">AI calls</span><b>{view.budget.actual.aiCalls}/{view.budget.planned.aiCalls}</b></div>
      <div className="border border-border rounded p-2"><span className="text-subtle block">Completed / failed / blocked</span><b>{view.counts.completed} / {view.counts.failed} / {view.counts.blocked}</b></div>
    </div>
    {view.providerUsage.length > 0 && <div className="mb-3"><p className="text-[10px] font-mono uppercase tracking-wide text-subtle mb-1">Provider activity</p><div className="flex flex-wrap gap-1">{view.providerUsage.map((entry, index) => <Badge key={`${entry.provider}-${entry.stage}-${index}`} className={statusClass.draft}>{entry.provider}:{entry.stage} ×{entry.requests}{entry.failures ? ` (${entry.failures} failed)` : ""}</Badge>)}</div></div>}
    {view.errors.length > 0 && <div className="mb-3 space-y-1">{view.errors.map((issue) => <div key={issue.stepId} className="text-xs border border-danger/30 bg-danger/5 text-danger rounded px-2 py-1">{issue.errorCategory ? `[${issue.errorCategory}] ` : ""}{issue.message || issue.title}</div>)}</div>}
    {view.failureReason && view.status !== "completed" && <p className="text-xs text-muted mb-3">{view.failureReason}</p>}
    <div className="space-y-1">{view.steps.map((item) => <div key={item.id} className="flex items-center gap-2 text-xs flex-wrap"><Badge className={statusClass[item.status] ?? statusClass.draft}>{item.status}</Badge><span className="font-mono text-accent">{String(item.order).padStart(2, "0")}</span><span>{item.title || item.type.replace(/_/g, " ")}</span>{item.searchRunIds.map((runId) => <a key={runId} className="text-accent hover:underline font-mono" href={`/discover/runs/${runId}`}>{runId}</a>)}{item.outputIds.map((outputId) => <span key={outputId} className="font-mono text-subtle">output:{outputId}</span>)}{item.reason && item.status !== "completed" && <span className="text-subtle truncate max-w-full">{item.reason}</span>}</div>)}</div>
  </Card>;

  if (loading) return <Card title="Research Plan"><div className="h-28 animate-pulse bg-surface-2 rounded" /></Card>;
  const historicalExecutions = executions.filter((execution) => execution.id !== statusView?.id);
  return <div className="space-y-4">
    <Card title="Research Plan" subtitle="Execution is durable: work continues outside this page and survives restarts." headerAction={<Button size="sm" onClick={create} isLoading={busy === "create"}>New plan</Button>}>
      {message && <div className="mb-3 border border-danger/30 bg-danger/5 text-danger rounded px-3 py-2 text-xs">{message}</div>}
      {!selected ? <p className="text-sm text-subtle">No research plan exists yet.</p> : <>
        <div className="flex flex-wrap items-center gap-2 mb-3"><span className="text-sm font-semibold text-foreground">Plan v{selected.version}</span><Badge className={statusClass[selected.status] ?? statusClass.draft}>{selected.status.replace(/_/g, " ")}</Badge><span className="text-[10px] font-mono text-subtle">{selected.estimatedProviders.join(", ") || "existing pipeline"}</span></div>
        <p className="text-xs text-muted mb-3">{selected.objectiveSnapshot.objective as string}</p>
        <div className="grid gap-2 sm:grid-cols-4 mb-4 text-xs"><div className="border border-border rounded p-2"><span className="text-subtle block">External requests</span><b>{estimatedRequests}</b></div><div className="border border-border rounded p-2"><span className="text-subtle block">Candidates</span><b>{selected.plannedBudget.candidates}</b></div><div className="border border-border rounded p-2"><span className="text-subtle block">Firecrawl pages</span><b>{selected.plannedBudget.firecrawlPages}</b></div><div className="border border-border rounded p-2"><span className="text-subtle block">AI calls</span><b>{selected.plannedBudget.aiCalls}</b></div></div>
        {step && <Input label="Business categories (comma separated)" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} disabled={selected.status === "executing" || selected.status === "completed" || selected.status === "completed_with_errors" || selected.status === "failed" || selected.status === "superseded"} hint="Editing creates a new immutable plan version." />}
        <div className="space-y-2 mt-4">{selected.steps.map((item) => <div key={item.id} className="border border-border rounded-md p-3"><div className="flex items-start gap-2"><span className="font-mono text-[10px] text-accent">{String(item.order).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="flex gap-2 items-center flex-wrap"><b className="text-sm text-foreground">{item.title}</b><Badge className="border-border bg-surface-2 text-subtle">{item.type.replace(/_/g, " ")}</Badge>{!item.enabled && <Badge className="border-border bg-surface-2 text-subtle">disabled</Badge>}</div><p className="text-xs text-muted mt-1">{item.reason}</p><p className="text-[10px] text-subtle mt-1">Depends on: {item.dependencies.join(", ") || "none"} · Budget: {Object.entries(item.budget).filter(([, value]) => typeof value === "number" && value > 0).map(([key, value]) => `${key} ${value ?? 0}`).join(" · ") || "none"}</p></div></div></div>)}</div>
        <div className="flex flex-wrap gap-2 mt-4">{(selected.status === "draft" || selected.status === "review" || selected.status === "approved") && <Button variant="secondary" size="sm" onClick={save} isLoading={busy === "save"}>Save as new version</Button>}{(selected.status === "draft" || selected.status === "review") && <Button size="sm" onClick={approve} isLoading={busy === "approve"}>Approve plan</Button>}{(selected.status === "draft" || selected.status === "review") && <Button size="sm" onClick={approveAndRun} isLoading={busy === "approveAndRun"}>Approve & Run</Button>}{selected.status === "approved" && <Button size="sm" onClick={execute} isLoading={busy === "execute"}>Execute approved plan</Button>}</div>
      </>}
    </Card>
    {statusView && renderExecutionCard(statusView)}
    {historicalExecutions.map((execution) => <Card key={execution.id} title={`Execution ${execution.id.slice(-8)}`} subtitle={`${execution.status.replace(/_/g, " ")} · ${new Date(execution.startedAt).toLocaleString()}`}><div className="grid gap-2 sm:grid-cols-3 text-xs mb-3">{Object.entries(execution.actualUsage).filter(([, value]) => typeof value === "number" && value > 0).map(([key, value]) => <div key={key} className="border border-border rounded p-2"><span className="text-subtle block">{key}</span><b>{value ?? 0}</b></div>)}</div><div className="space-y-1">{execution.steps.map((item) => <div key={item.id} className="flex items-center gap-2 text-xs"><Badge className={statusClass[item.status] ?? statusClass.draft}>{item.status}</Badge><span>{item.reason ?? item.provider ?? "step recorded"}</span>{item.searchRunIds.map((runId) => <a key={runId} className="text-accent hover:underline font-mono" href={`/discover/runs/${runId}`}>{runId}</a>)}{item.outputIds.map((outputId) => <span key={outputId} className="font-mono text-subtle">output:{outputId}</span>)}</div>)}</div></Card>)}
  </div>;
}
