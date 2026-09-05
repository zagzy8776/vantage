"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const TERMINAL = ["completed", "completed_with_errors", "failed"];

type SearchRun = { id: string; query: string; country: string; city: string | null; status: string; discoveredCount: number; durationMs: number | null; createdAt: string };
type JobSearch = { id: string; query: string; countryCode: string | null; country: string | null; city: string | null; remote: boolean; directOnly: boolean; postedWithinDays: number; providers: string[] | null; resultCount: number; createdAt: string };

function statusLabel(status: string) { if (status === "completed_with_errors") return "Completed with issues"; if (status === "running") return "Researching"; return status.replaceAll("_", " "); }
function locationLabel(search: JobSearch) { return [search.city, search.country].filter(Boolean).join(", ") || "Any location"; }
function formatSearchDate(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }

export default function HistoryPage() {
  const [runs, setRuns] = useState<SearchRun[]>([]);
  const [jobSearches, setJobSearches] = useState<JobSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [researchResponse, jobsResponse] = await Promise.all([
        fetch("/api/discover/runs?limit=50", { cache: "no-store" }),
        fetch("/api/jobs/history?limit=50", { cache: "no-store" }),
      ]);
      const researchPayload = await researchResponse.json().catch(() => null);
      const jobsPayload = await jobsResponse.json().catch(() => null);
      if (!researchResponse.ok) throw new Error(researchPayload?.error ?? "Research history is unavailable.");
      if (!jobsResponse.ok) throw new Error(jobsPayload?.error ?? "Job search history is unavailable.");
      setRuns((researchPayload?.runs ?? []) as SearchRun[]);
      setJobSearches((jobsPayload?.history ?? []) as JobSearch[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "History is unavailable.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function clearJobSearches() {
    if (clearing || jobSearches.length === 0) return;
    setClearing(true);
    try {
      const response = await fetch("/api/jobs/history", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not clear job search history.");
      setJobSearches([]);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not clear job search history."); }
    finally { setClearing(false); }
  }

  return <main className="mx-auto w-full max-w-6xl space-y-10 px-4 pb-24 pt-8 md:px-6 md:pt-12">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="section-label">Workspace memory</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] md:text-5xl">History</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Your research runs and job searches stay here so you can pick up where you left off instead of rebuilding the same search.</p></div>
      <div className="flex gap-2"><Link href="/jobs" className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-white/90">Find jobs</Link><Link href="/discover" className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-white/65 hover:border-white/20">New research</Link></div>
    </header>

    {loading ? <div className="rounded-[24px] border border-white/10 bg-white/[.02] p-10 text-center text-sm text-white/35">Loading workspace history…</div> : error ? <div className="rounded-2xl border border-red-300/10 bg-red-300/[.03] p-4 text-sm text-red-100/60">{error}</div> : null}

    {!loading && !error && <>
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="section-label">Jobs</p><h2 className="mt-1 text-xl font-medium">Recent job searches</h2><p className="mt-1 text-xs text-white/30">Every live Jobs search is recorded, including country, city, remote and direct-employer filters.</p></div>{jobSearches.length > 0 && <button type="button" onClick={() => void clearJobSearches()} disabled={clearing} className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/40 hover:border-white/20 hover:text-white/60 disabled:opacity-40">{clearing ? "Clearing…" : "Clear job searches"}</button>}</div>
        {jobSearches.length === 0 ? <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[.015] p-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[.025] text-sm font-semibold text-white/30">J</div><h3 className="mt-4 text-sm font-medium">No job searches yet</h3><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-white/30">Search for a role from Jobs and Vantage will automatically keep the search here.</p><Link href="/jobs" className="mt-5 inline-flex rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/65 hover:border-white/20">Search jobs</Link></div> : <div className="grid gap-3 lg:grid-cols-2">{jobSearches.map((search) => <Link key={search.id} href="/jobs" className="group rounded-[22px] border border-white/10 bg-white/[.018] p-5 transition hover:border-white/20 hover:bg-white/[.03]"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/10 bg-white/[.025] px-2 py-1 text-[9px] uppercase tracking-[.14em] text-white/35">Job search</span>{search.countryCode && <span className="text-[10px] text-white/25">{search.countryCode}</span>}</div><h3 className="mt-3 truncate text-base font-medium text-white/85">{search.query}</h3><p className="mt-1 text-xs text-white/35">{locationLabel(search)} · {formatSearchDate(search.createdAt)}</p></div><span className="text-xs text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/45">→</span></div><div className="mt-4 flex flex-wrap gap-2 text-[10px] text-white/35"><span className="rounded-full border border-white/10 px-2.5 py-1">{search.resultCount} results</span><span className="rounded-full border border-white/10 px-2.5 py-1">Last {search.postedWithinDays} days</span>{search.remote && <span className="rounded-full border border-white/10 px-2.5 py-1">Remote</span>}{search.directOnly && <span className="rounded-full border border-white/10 px-2.5 py-1">Direct employer</span>}</div></Link>)}</div>}
      </section>

      <section className="space-y-4">
        <div><p className="section-label">Research</p><h2 className="mt-1 text-xl font-medium">Research history</h2><p className="mt-1 text-xs text-white/30">Business and opportunity research runs remain available here.</p></div>
        {runs.length === 0 ? <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[.015] p-10 text-center"><h3 className="text-sm font-medium">No research runs yet</h3><p className="mt-1 text-xs text-white/30">Run a discovery scan and Vantage will keep the result in workspace memory.</p><Link href="/discover" className="mt-5 inline-flex rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/65 hover:border-white/20">Start research</Link></div> : <div className="space-y-3">{runs.map((run) => { const location = [run.city, run.country].filter(Boolean).join(", "); const terminal = TERMINAL.includes(run.status); return <Link key={run.id} href={`/discover/${encodeURIComponent(run.id)}`} className="block rounded-[22px] border border-white/10 bg-white/[.018] p-5 transition hover:border-white/20 hover:bg-white/[.03]"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-medium text-white/80">{run.query}</h2><p className="mt-1 text-xs text-white/30">{location || "Any location"} · {new Date(run.createdAt).toLocaleString()}</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[.12em] ${terminal ? "border-white/10 text-white/35" : "border-white/15 text-white/60"}`}>{statusLabel(run.status)}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div><span className="block text-white/25">Businesses</span><b className="font-medium text-white/65">{run.discoveredCount}</b></div><div><span className="block text-white/25">Duration</span><b className="font-medium text-white/65">{run.durationMs != null ? `${Math.round(run.durationMs / 1000)}s` : "Running"}</b></div><div><span className="block text-white/25">Run ID</span><b className="block truncate font-mono font-medium text-white/45">{run.id.slice(0, 14)}…</b></div><div className="text-right sm:text-left"><span className="block text-white/25">Action</span><b className="font-medium text-white/55">Reopen →</b></div></div></Link>; })}</div>}
      </section>
    </>}
  </main>;
}
