"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const TERMINAL = ["completed", "completed_with_errors", "failed"];

type SearchRun = {
  id: string;
  query: string;
  country: string;
  city: string | null;
  status: string;
  discoveredCount: number;
  durationMs: number | null;
  createdAt: string;
};

function statusLabel(status: string) {
  if (status === "completed_with_errors") return "Completed with issues";
  if (status === "running") return "Researching";
  return status.replaceAll("_", " ");
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<SearchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/discover/runs?limit=50", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Research history is unavailable.");
      setRuns((payload?.runs ?? []) as SearchRun[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research history is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-mono">Workspace memory</p>
          <h1 className="text-2xl font-extrabold font-mono tracking-tight mt-1">Research History</h1>
          <p className="text-sm text-subtle mt-1 max-w-2xl">Every scan stays attached to your workspace. Reopen an old result or start a fresh scan in another area.</p>
        </div>
        <Link href="/discover" className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:opacity-90">New scan</Link>
      </header>

      {loading ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-subtle">Loading saved research…</div>
      ) : error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm">{error}</div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <h2 className="font-semibold">Your research history is empty</h2>
          <p className="text-sm text-subtle mt-1">Run your first discovery scan and VANTAGE will keep it here.</p>
          <Link href="/discover" className="inline-flex mt-5 rounded-md border border-border px-4 py-2 text-xs font-semibold hover:border-accent">Start researching</Link>
        </div>
      ) : (
        <section className="space-y-3">
          {runs.map((run) => {
            const location = [run.city, run.country].filter(Boolean).join(", ");
            const terminal = TERMINAL.includes(run.status);
            return (
              <Link key={run.id} href={`/discover?run=${encodeURIComponent(run.id)}`} className="block rounded-xl border border-border bg-surface p-4 hover:border-accent/50 hover:bg-surface-2/30 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{run.query}</h2>
                    <p className="text-xs text-subtle mt-1">{location || "Any location"} · {new Date(run.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[10px] uppercase font-mono ${terminal ? "border-border text-subtle" : "border-accent/40 text-accent"}`}>{statusLabel(run.status)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                  <div><span className="text-subtle block">Businesses</span><b>{run.discoveredCount}</b></div>
                  <div><span className="text-subtle block">Duration</span><b>{run.durationMs != null ? `${Math.round(run.durationMs / 1000)}s` : "Running"}</b></div>
                  <div><span className="text-subtle block">Run ID</span><b className="font-mono truncate block">{run.id.slice(0, 14)}…</b></div>
                  <div className="text-right sm:text-left"><span className="text-subtle block">Action</span><b className="text-accent">Reopen →</b></div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
