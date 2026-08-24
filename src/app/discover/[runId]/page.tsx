"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

 type Run = { id: string; query: string; country: string; city: string | null; status: string; discoveredCount: number; createdAt: string; durationMs: number | null; result?: { results?: Array<{ name?: string; category?: string; city?: string; website?: string; phone?: string; rating?: number }> } | null };

export default function ScanDetailPage({ params }: { params: { runId: string } }) {
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/discover/runs/${encodeURIComponent(params.runId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? "Saved scan is unavailable.");
        setRun(payload as Run);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Saved scan is unavailable."))
      .finally(() => setLoading(false));
  }, [params.runId]);

  if (loading) return <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-subtle">Opening saved research…</div>;
  if (error || !run) return <div className="space-y-4"><Link href="/history" className="text-xs text-accent">← Research history</Link><div className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm">{error ?? "Saved scan not found."}</div></div>;

  const businesses = run.result?.results ?? [];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><Link href="/history" className="text-xs text-accent">← Research history</Link><p className="text-[10px] uppercase tracking-[0.22em] text-accent font-mono mt-4">Saved scan</p><h1 className="text-2xl font-extrabold font-mono mt-1">{run.query}</h1><p className="text-sm text-subtle mt-1">{[run.city, run.country].filter(Boolean).join(", ") || "Any location"} · {run.discoveredCount} businesses · {run.status.replaceAll("_", " ")}</p></div>
        <Link href="/discover" className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground">Start another scan</Link>
      </div>
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4"><span className="text-[10px] uppercase font-mono text-subtle">Businesses</span><p className="text-2xl font-mono font-bold mt-1">{run.discoveredCount}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><span className="text-[10px] uppercase font-mono text-subtle">Status</span><p className="text-sm font-semibold mt-2 capitalize">{run.status.replaceAll("_", " ")}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><span className="text-[10px] uppercase font-mono text-subtle">Duration</span><p className="text-sm font-semibold mt-2">{run.durationMs != null ? `${Math.round(run.durationMs / 1000)}s` : "—"}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><span className="text-[10px] uppercase font-mono text-subtle">Saved</span><p className="text-xs font-semibold mt-2">{new Date(run.createdAt).toLocaleString()}</p></div>
      </section>
      <section className="space-y-3"><div><h2 className="font-semibold">Businesses from this scan</h2><p className="text-xs text-subtle mt-1">This is the persisted result set. Returning here does not trigger a new provider search.</p></div>{businesses.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-subtle">No business records were persisted for this scan.</div> : <div className="grid gap-3 md:grid-cols-2">{businesses.map((business, index) => <article key={`${business.name}-${index}`} className="rounded-xl border border-border bg-surface p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{business.name ?? "Unnamed business"}</h3><p className="text-xs text-subtle mt-1">{business.category ?? "Business"} · {business.city ?? run.city ?? "Location unknown"}</p></div>{business.rating != null && <span className="text-xs font-mono">★ {business.rating}</span>}</div><div className="mt-4 space-y-1 text-xs text-subtle">{business.website ? <p>Website: <span className="text-foreground">{business.website}</span></p> : <p className="text-accent">No website evidence found in this scan.</p>}{business.phone && <p>Phone: {business.phone}</p>}</div></article>)}</div>}</section>
    </div>
  );
}
