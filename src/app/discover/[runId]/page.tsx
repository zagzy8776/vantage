"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

 type RunBusiness = {
  leadId?: string;
  externalId?: string;
  source?: string;
  sources?: string[];
  name?: string;
  category?: string;
  country?: string;
  region?: string;
  city?: string;
  area?: string;
  street?: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  verificationStatus?: string;
  dataFreshness?: string;
  observedAt?: string;
 };

type Run = {
  id: string;
  query: string;
  country: string;
  city: string | null;
  status: string;
  discoveredCount: number;
  createdAt: string;
  durationMs: number | null;
  result?: { results?: RunBusiness[]; workflow?: { cacheHit?: boolean; stage?: string; aiAnalyzedCount?: number } } | null;
  summary?: { discovered?: number; verified?: number; enriched?: number; analyzed?: number; hasIssues?: boolean };
};

function freshnessLabel(value?: string, observedAt?: string) {
  if (value) return value;
  if (!observedAt) return null;
  const age = Date.now() - new Date(observedAt).getTime();
  if (!Number.isFinite(age) || age < 0) return null;
  const days = Math.floor(age / 86_400_000);
  if (days === 0) return "Observed today";
  if (days === 1) return "Observed yesterday";
  return `Observed ${days}d ago`;
}

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
  const analyzed = run.summary?.analyzed ?? run.result?.workflow?.aiAnalyzedCount ?? 0;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/history" className="text-xs text-accent">← Research history</Link>
          <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-mono mt-4">Saved scan</p>
          <h1 className="text-2xl font-extrabold font-mono mt-1">{run.query}</h1>
          <p className="text-sm text-subtle mt-1">{[run.city, run.country].filter(Boolean).join(", ") || "Any location"} · {run.discoveredCount} businesses · {run.status.replaceAll("_", " ")}</p>
          {run.result?.workflow?.cacheHit && <p className="text-[11px] text-warning mt-2">Loaded from saved provider research. Business details can be opened individually for fresh verification.</p>}
        </div>
        <Link href="/discover" className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground">Start another scan</Link>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4"><span className="text-[10px] uppercase font-mono text-subtle">Businesses</span><p className="text-2xl font-mono font-bold mt-1">{run.discoveredCount}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><span className="text-[10px] uppercase font-mono text-subtle">Verified</span><p className="text-2xl font-mono font-bold mt-1">{run.summary?.verified ?? 0}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><span className="text-[10px] uppercase font-mono text-subtle">Enriched</span><p className="text-2xl font-mono font-bold mt-1">{run.summary?.enriched ?? 0}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><span className="text-[10px] uppercase font-mono text-subtle">AI analyzed</span><p className="text-2xl font-mono font-bold mt-1">{analyzed}</p></div>
        <div className="rounded-lg border border-border bg-surface p-4"><span className="text-[10px] uppercase font-mono text-subtle">Saved</span><p className="text-xs font-semibold mt-2">{new Date(run.createdAt).toLocaleString()}</p></div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Businesses from this scan</h2>
          <p className="text-xs text-subtle mt-1">Open a business to continue research, review evidence, and run or revisit AI intelligence.</p>
        </div>
        {businesses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-subtle">No business records were persisted for this scan.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {businesses.map((business, index) => {
              const leadId = business.leadId;
              const freshness = freshnessLabel(business.dataFreshness, business.observedAt);
              const content = (
                <article className="rounded-xl border border-border bg-surface p-4 transition hover:border-accent/35 hover:bg-surface-2/30 h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{business.name ?? "Unnamed business"}</h3>
                      <p className="text-xs text-subtle mt-1">{business.category ?? "Business"} · {business.city ?? run.city ?? "Location unknown"}</p>
                    </div>
                    {business.rating != null && <span className="text-xs font-mono shrink-0">★ {business.rating}</span>}
                  </div>
                  <div className="mt-4 space-y-1.5 text-xs text-subtle">
                    {business.website ? <p className="truncate">Website: <span className="text-foreground">{business.website}</span></p> : <p className="text-accent">No official website found.</p>}
                    {business.phone && <p>Phone: {business.phone}</p>}
                    {business.sources?.length ? <p>Sources: {business.sources.join(", ")}</p> : business.source ? <p>Source: {business.source}</p> : null}
                    {freshness && <p className="text-warning">{freshness}</p>}
                    {business.verificationStatus && <p>Verification: {business.verificationStatus}</p>}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-[10px] uppercase font-mono text-subtle">{leadId ? "Lead intelligence available" : "Lead record unavailable"}</span>
                    <span className="text-xs text-accent font-semibold">{leadId ? "Open lead →" : "Re-search →"}</span>
                  </div>
                </article>
              );
              return leadId ? <Link key={`${business.externalId ?? business.name}-${index}`} href={`/leads/${encodeURIComponent(leadId)}`} className="block">{content}</Link> : <Link key={`${business.externalId ?? business.name}-${index}`} href="/discover" className="block">{content}</Link>;
            })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3 text-xs text-subtle border-t border-border pt-4">
        {run.result?.workflow?.cacheHit && <span>Cached source run: {run.result.workflow.cacheSourceRunId ? String(run.result.workflow.cacheSourceRunId).slice(0, 18) + "…" : "saved research"}</span>}
        {run.summary?.hasIssues && <span className="text-warning">This scan completed with operational issues. Re-run for a fresh provider pass.</span>}
      </div>
    </div>
  );
}
