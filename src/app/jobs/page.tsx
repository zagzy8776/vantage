"use client";

import { useMemo, useState } from "react";

type Job = {
  id: string; title: string; companyName: string; location?: string; countryCode?: string;
  employmentType?: string; remote?: boolean; salaryMin?: number; salaryMax?: number;
  salaryCurrency?: string; postedAt?: string; applyUrl?: string; sourceName?: string;
  verificationStatus: "verified" | "needs_verification" | "unverified";
  verificationScore: number; verificationReasons: string[];
};

type SearchResponse = { jobs: Job[]; providers: { provider: string; status: string; count: number }[]; error?: string };

const statusCopy = {
  verified: "Verified employer",
  needs_verification: "Needs verification",
  unverified: "Unverified",
};

function money(job: Job) {
  if (job.salaryMin == null && job.salaryMax == null) return "Salary not disclosed";
  const currency = job.salaryCurrency ?? "USD";
  const format = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  if (job.salaryMin != null && job.salaryMax != null) return `${format(job.salaryMin)} – ${format(job.salaryMax)}`;
  return format(job.salaryMin ?? job.salaryMax!);
}

function timeAgo(value?: string) {
  if (!value) return "Date unavailable";
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.max(0, Math.floor(diff / 86400000));
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
}

export default function JobsPage() {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("US");
  const [remote, setRemote] = useState(false);
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");

  const verifiedCount = useMemo(() => data?.jobs.filter((j) => j.verificationStatus === "verified").length ?? 0, [data]);

  async function search() {
    if (!title.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/jobs/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), city: location.trim() || undefined, country: location.trim() || undefined, countryCode: country, remote, postedWithinDays: Number(days), limit: 30 }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      setData(body);
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed"); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto max-w-[1400px] px-5 py-8 md:px-8">
        <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">VANTAGE / Intelligence</div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">Jobs intelligence</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Search live job markets across multiple providers. Verification is evidence-based — Vantage never invents employer or job data.</p>
          </div>
          {data && <div className="flex gap-2 text-xs text-white/55"><span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2">{data.jobs.length} results</span><span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2">{verifiedCount} verified</span></div>}
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[.035] p-3 shadow-2xl shadow-black/20 md:p-4">
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_110px_auto]">
            <label className="rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 focus-within:border-white/25"><span className="block text-[10px] font-medium uppercase tracking-wider text-white/35">Role</span><input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="e.g. Senior frontend engineer" className="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-white/25" /></label>
            <label className="rounded-xl border border-white/10 bg-black/20 px-4 py-2.5"><span className="block text-[10px] font-medium uppercase tracking-wider text-white/35">Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or region" className="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-white/25" /></label>
            <label className="rounded-xl border border-white/10 bg-black/20 px-4 py-2.5"><span className="block text-[10px] font-medium uppercase tracking-wider text-white/35">Country</span><select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full bg-transparent text-sm outline-none"><option className="bg-[#0b0e13]">US</option><option className="bg-[#0b0e13]">CA</option><option className="bg-[#0b0e13]">GB</option><option className="bg-[#0b0e13]">NG</option><option className="bg-[#0b0e13]">DE</option><option className="bg-[#0b0e13]">AU</option></select></label>
            <button onClick={search} disabled={loading || !title.trim()} className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Searching…" : "Search market"}</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 px-1 text-xs text-white/50">
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="accent-white" /> Remote only</label>
            <label className="flex items-center gap-2">Freshness <select value={days} onChange={(e) => setDays(e.target.value)} className="bg-transparent text-white/70 outline-none"><option className="bg-[#0b0e13]" value="1">24 hours</option><option className="bg-[#0b0e13]" value="7">7 days</option><option className="bg-[#0b0e13]" value="30">30 days</option><option className="bg-[#0b0e13]" value="90">90 days</option></select></label>
          </div>
        </section>

        {error && <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">{error}</div>}

        {!data && !loading && <section className="mt-16 grid place-items-center py-16 text-center"><div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[.04] text-xl">⌕</div><h2 className="text-lg font-medium">Start with a market</h2><p className="mt-2 max-w-md text-sm leading-6 text-white/40">Search a role and location to see live opportunities. Results remain clearly labeled until employer ownership is independently established.</p></section>}

        {loading && <div className="mt-6 space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[.025]" />)}</div>}

        {data && !loading && <>
          <div className="mt-6 flex items-center justify-between"><div className="text-xs text-white/40">Live provider results</div><div className="flex gap-2">{data.providers.map((p) => <span key={p.provider} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/40">{p.provider} · {p.count}</span>)}</div></div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
            {data.jobs.length === 0 ? <div className="p-12 text-center text-sm text-white/45">No live results matched this market. Try a broader role, city, or freshness window.</div> : data.jobs.map((job) => <article key={job.id} className="group border-b border-white/[.07] bg-white/[.018] p-5 transition hover:bg-white/[.04] last:border-0 md:p-6"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-semibold tracking-[-.01em]">{job.title}</h2><span className={`rounded-full border px-2 py-1 text-[10px] ${job.verificationStatus === "verified" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : job.verificationStatus === "needs_verification" ? "border-amber-400/20 bg-amber-400/10 text-amber-300" : "border-white/10 bg-white/[.04] text-white/40"}`}>{statusCopy[job.verificationStatus]}</span></div><div className="mt-2 text-sm text-white/65">{job.companyName} <span className="px-1 text-white/20">·</span> {job.location ?? "Location unavailable"}</div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/35"><span>{job.remote ? "Remote" : job.employmentType ?? "Employment type unavailable"}</span><span>{money(job)}</span><span>{timeAgo(job.postedAt)}</span><span>{job.sourceName ?? job.id.split(":")[0]}</span></div></div>{job.applyUrl ? <a href={job.applyUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-white/10 px-4 py-2.5 text-xs font-medium text-white/75 transition hover:border-white/25 hover:bg-white/[.05]">View source ↗</a> : <span className="text-xs text-white/25">No application link</span>}</div>{job.verificationReasons?.length > 0 && <div className="mt-4 text-[11px] text-white/30">Evidence: {job.verificationReasons[0]}</div>}</article>)}
          </div>
        </>}
      </div>
    </main>
  );
}
