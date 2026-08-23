"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

type RunDiagnostics = {
  runId: string;
  status: string;
  query: { category: string; country: string; city: string | null; depth: string };
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  stages: Record<string, { status?: string; durationMs?: number; count?: number; errorCount?: number }>;
  failures: Array<{ stage: string; provider?: string; safeMessage?: string; messageCode: string }>;
};

export default function SearchRunDiagnosticsPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const [run, setRun] = useState<RunDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/discover/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Search run diagnostics are unavailable.");
      setRun(payload as RunDiagnostics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search run diagnostics are unavailable.");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route-load data fetch
    load();
  }, [load]);

  if (loading) return <Card className="animate-pulse"><div className="h-6 bg-surface-2 rounded w-1/3 mb-3" /><div className="h-32 bg-surface-2 rounded" /></Card>;
  if (error || !run) return <div className="space-y-3"><EmptyState title="Search run unavailable" description={error ?? "Search run not found."} /><div className="text-center"><Button variant="secondary" onClick={load}>Retry</Button></div></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3"><div><Link href="/investigations" className="text-xs text-accent hover:underline">← Investigations</Link><h1 className="text-xl font-extrabold font-mono mt-2">Search Run Diagnostics</h1><p className="text-sm text-subtle mt-1">{run.query.category} · {[run.query.city, run.query.country].filter(Boolean).join(", ")} · {run.query.depth}</p></div><span className="text-[10px] font-mono uppercase border border-border rounded px-2 py-1 text-muted">{run.status.replace(/_/g, " ")}</span></div>
      <Card title="Run summary"><div className="grid gap-3 sm:grid-cols-4 text-sm"><div><div className="text-[10px] uppercase text-subtle">Run ID</div><div className="font-mono text-xs break-all">{run.runId}</div></div><div><div className="text-[10px] uppercase text-subtle">Started</div><div>{formatDate(run.startedAt)}</div></div><div><div className="text-[10px] uppercase text-subtle">Completed</div><div>{formatDate(run.completedAt)}</div></div><div><div className="text-[10px] uppercase text-subtle">Duration</div><div>{typeof run.durationMs === "number" ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}</div></div></div></Card>
      <Card title="Stages"><div className="space-y-2">{Object.entries(run.stages).map(([stage, details]) => <div key={stage} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0"><span className="text-sm text-muted">{stage.replace(/_/g, " ")}</span><span className="text-[10px] font-mono text-subtle">{details.status ?? "unknown"}{typeof details.count === "number" ? ` · ${details.count}` : ""}{typeof details.durationMs === "number" ? ` · ${(details.durationMs / 1000).toFixed(1)}s` : ""}</span></div>)}</div></Card>
      <Card title={`Failures (${run.failures.length})`}>{run.failures.length === 0 ? <p className="text-sm text-subtle">No recorded failures.</p> : <div className="space-y-2">{run.failures.map((failure, index) => <div key={`${failure.stage}-${index}`} className="border border-warning/30 rounded-md p-3"><div className="text-xs font-mono text-warning">{failure.stage}{failure.provider ? ` · ${failure.provider}` : ""} · {failure.messageCode}</div><p className="text-sm text-muted mt-1">{failure.safeMessage ?? "No safe diagnostic message recorded."}</p></div>)}</div>}</Card>
    </div>
  );
}