"use client";

import { FormEvent, useMemo, useState } from "react";

type Intelligence = {
  summary: string; seniority?: string; mustHave: string[]; niceToHave: string[]; skills: string[];
  experience?: string; education?: string; responsibilities: string[]; locationRequirement?: string;
  remotePolicy?: string; applicationAdvice: string[]; unknowns: string[]; confidence: number; provider?: string; model?: string;
};

type Job = {
  id: string; title: string; companyName: string; companyWebsite?: string; companyDomain?: string; location?: string;
  countryCode?: string; employmentType?: string; remote?: boolean; salaryMin?: number; salaryMax?: number; salaryCurrency?: string;
  postedAt?: string; applyUrl?: string; sourceUrl?: string; sourceName?: string; requirements?: string[]; intelligence?: Intelligence;
  verificationStatus: "direct_employer_verified" | "needs_verification" | "unverified" | "rejected" | "stale";
  verificationScore: number; verificationReasons: string[];
};

type SearchResponse = { jobs: Job[]; providers: { provider: string; status: string; count: number }[]; intelligence?: { attempted: number; analyzed: number }; error?: string };

const countries = [["US", "United States"], ["NG", "Nigeria"], ["GB", "United Kingdom"], ["CA", "Canada"], ["DE", "Germany"], ["AU", "Australia"], ["FR", "France"], ["NL", "Netherlands"], ["IE", "Ireland"], ["ZA", "South Africa"]] as const;
const statusCopy = { direct_employer_verified: "Direct employer verified", needs_verification: "Needs verification", unverified: "Discovered", rejected: "Verification rejected", stale: "Listing may be stale" } as const;

function money(job: Job) {
  if (job.salaryMin == null && job.salaryMax == null) return "Salary not disclosed";
  const currency = job.salaryCurrency ?? "USD";
  const format = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  if (job.salaryMin != null && job.salaryMax != null) return `${format(job.salaryMin)} – ${format(job.salaryMax)}`;
  return format(job.salaryMin ?? job.salaryMax!);
}
function timeAgo(value?: string) {
  if (!value) return "Posting date unavailable";
  const time = new Date(value).getTime(); if (!Number.isFinite(time)) return "Posting date unavailable";
  const hours = Math.floor(Math.max(0, Date.now() - time) / 3600000);
  if (hours < 1) return "Posted just now"; if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24); return days === 1 ? "Yesterday" : `${days}d ago`;
}
function hostname(value?: string) { try { return value ? new URL(value).hostname.replace(/^www\./, "") : ""; } catch { return ""; } }

export default function JobsPage() {
  const [title, setTitle] = useState(""); const [location, setLocation] = useState(""); const [country, setCountry] = useState("US");
  const [remote, setRemote] = useState(false); const [days, setDays] = useState("30"); const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null); const [error, setError] = useState(""); const [directOnly, setDirectOnly] = useState(false);
  const visibleJobs = useMemo(() => data ? (directOnly ? data.jobs.filter((job) => job.verificationStatus === "direct_employer_verified") : data.jobs) : [], [data, directOnly]);
  const verifiedCount = useMemo(() => data?.jobs.filter((j) => j.verificationStatus === "direct_employer_verified").length ?? 0, [data]);
  const intelligenceCount = useMemo(() => data?.jobs.filter((j) => Boolean(j.intelligence)).length ?? 0, [data]);

  async function search(event?: FormEvent) {
    event?.preventDefault(); if (!title.trim()) return; setLoading(true); setError("");
    try {
      const res = await fetch("/api/jobs/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), city: location.trim() || undefined, country: countries.find(([code]) => code === country)?.[1], countryCode: country, remote, postedWithinDays: Number(days), limit: 30 }) });
      const body = await res.json(); if (!res.ok) throw new Error(body.error ?? "Search failed"); setData(body);
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed"); } finally { setLoading(false); }
  }

  return <main className="min-h-screen overflow-x-hidden bg-[#06080c] text-white selection:bg-white selection:text-black">
    <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.08),transparent_58%)]" />
    <div className="relative mx-auto max-w-[1440px] px-5 pb-16 pt-7 md:px-8 md:pt-10">
      <header className="mb-9 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><div className="mb-3 text-[10px] font-semibold uppercase tracking-[.24em] text-white/35"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />Vantage / Opportunity intelligence</div>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-[-.045em] md:text-[44px] md:leading-[1.05]">Find the jobs that are actually hiring.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/45 md:text-[15px]">Vantage discovers jobs, researches public employer sources, then uses evidence-grounded intelligence to explain what the employer needs before you leave Vantage.</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[.035] px-3 py-2 text-xs text-white/45">Evidence-first + AI research</div>
      </header>

      <form onSubmit={search} className="rounded-[22px] border border-white/10 bg-white/[.035] p-2 shadow-[0_24px_80px_rgba(0,0,0,.28)] backdrop-blur-xl md:p-3">
        <div className="grid gap-2 md:grid-cols-[1.55fr_1fr_170px_auto]">
          <label className="flex min-h-[64px] items-center rounded-[15px] border border-white/10 bg-black/20 px-4"><span className="mr-3 text-white/30">⌕</span><span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Role or skill</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Software engineer, accountant..." className="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-white/20" /></span></label>
          <label className="flex min-h-[64px] items-center rounded-[15px] border border-white/10 bg-black/20 px-4"><span className="mr-3 text-white/30">⌖</span><span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or region" className="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-white/20" /></span></label>
          <label className="flex min-h-[64px] items-center rounded-[15px] border border-white/10 bg-black/20 px-4"><span className="mr-3 text-white/30">▣</span><span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Country</span><select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full bg-transparent text-sm outline-none"><option className="bg-[#0b0e13]" value="US">United States</option>{countries.filter(([code]) => code !== "US").map(([code, name]) => <option key={code} className="bg-[#0b0e13]" value={code}>{name}</option>)}</select></span></label>
          <button type="submit" disabled={loading || !title.trim()} className="min-h-[64px] rounded-[15px] bg-white px-7 text-sm font-semibold text-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35">{loading ? "Researching…" : "Search jobs"}</button>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-3 pb-1 pt-3 text-xs text-white/45"><label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={directOnly} onChange={(e) => setDirectOnly(e.target.checked)} className="h-3.5 w-3.5 accent-white" /> Direct-employer results</label><label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="h-3.5 w-3.5 accent-white" /> Remote only</label><label>Freshness <select value={days} onChange={(e) => setDays(e.target.value)} className="ml-1 bg-transparent font-medium text-white/65 outline-none"><option className="bg-[#0b0e13]" value="1">24 hours</option><option className="bg-[#0b0e13]" value="7">7 days</option><option className="bg-[#0b0e13]" value="30">30 days</option><option className="bg-[#0b0e13]" value="90">90 days</option></select></label><span className="ml-auto hidden md:block">Discovery → public research → AI interpretation → application path</span></div>
      </form>

      {error && <div role="alert" className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/[.06] px-4 py-3 text-sm text-red-200">{error}</div>}
      {loading && <div className="mt-8 space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl border border-white/[.07] bg-white/[.025]" />)}</div>}

      {data && !loading && <section className="mt-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/30">Market results</div><div className="mt-1 flex flex-wrap items-center gap-3"><h2 className="text-lg font-medium">{visibleJobs.length} opportunities</h2><span className="text-xs text-emerald-300/70">{verifiedCount} directly verified</span><span className="text-xs text-white/35">{intelligenceCount} AI researched</span>{data.intelligence && <span className="text-xs text-white/25">{data.intelligence.analyzed}/{data.intelligence.attempted} analysed</span>}</div></div><div className="flex flex-wrap gap-1.5">{data.providers.map((p) => <span key={p.provider} title={`${p.provider}: ${p.status}`} className="rounded-full border border-white/[.08] bg-white/[.025] px-2.5 py-1.5 text-[10px] text-white/35">{p.provider} · {p.count}</span>)}</div></div>
        <div className="space-y-3">
          {visibleJobs.map((job) => { const ai = job.intelligence; const requirements = ai?.mustHave?.length ? ai.mustHave : job.requirements ?? []; const applicationUrl = job.applyUrl ?? (job.verificationStatus === "direct_employer_verified" ? job.companyWebsite : undefined); return <article key={job.id} className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[.018] shadow-[0_20px_60px_rgba(0,0,0,.18)]">
            <div className="p-5 md:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:justify-between"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/55">{statusCopy[job.verificationStatus]}</span><span className="text-[10px] text-white/25">Evidence {job.verificationScore}/100</span>{ai && <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[.06] px-2.5 py-1 text-[10px] text-emerald-200/70">AI confidence {ai.confidence}%</span>}</div><h3 className="text-xl font-medium tracking-[-.025em]">{job.title}</h3><div className="mt-1 text-sm text-white/55">{job.companyName}</div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/35"><span>{job.location ?? "Location not disclosed"}</span><span>{job.employmentType ?? "Employment type not disclosed"}</span><span>{timeAgo(job.postedAt)}</span></div></div><div className="lg:text-right"><div className="text-sm font-medium">{money(job)}</div><div className="mt-1 text-[10px] text-white/25">{job.sourceName ?? "Discovery source"}</div></div></div>

              {ai ? <div className="mt-6 grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
                <div className="rounded-2xl border border-white/[.08] bg-black/20 p-4"><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/30">What the employer is asking for</div><p className="mt-2 text-sm leading-6 text-white/70">{ai.summary}</p>{requirements.length > 0 && <><div className="mt-4 text-[10px] font-semibold uppercase tracking-[.18em] text-white/30">Must-have requirements</div><ul className="mt-2 grid gap-2 text-sm text-white/65 md:grid-cols-2">{requirements.slice(0, 10).map((item, index) => <li key={index}>• {item}</li>)}</ul></>}{ai.skills.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{ai.skills.slice(0, 12).map((skill) => <span key={skill} className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/45">{skill}</span>)}</div>}</div>
                <div className="rounded-2xl border border-white/[.08] bg-black/20 p-4"><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/30">Candidate intelligence</div>{ai.experience && <div className="mt-3 text-sm"><span className="text-white/30">Experience · </span><span className="text-white/65">{ai.experience}</span></div>}{ai.education && <div className="mt-2 text-sm"><span className="text-white/30">Education · </span><span className="text-white/65">{ai.education}</span></div>}{ai.locationRequirement && <div className="mt-2 text-sm"><span className="text-white/30">Location · </span><span className="text-white/65">{ai.locationRequirement}</span></div>}{ai.remotePolicy && <div className="mt-2 text-sm"><span className="text-white/30">Remote · </span><span className="text-white/65">{ai.remotePolicy}</span></div>}{ai.unknowns.length > 0 && <div className="mt-4 border-t border-white/[.07] pt-3"><div className="text-[10px] uppercase tracking-[.16em] text-white/25">Still unknown</div><ul className="mt-2 space-y-1 text-xs text-white/40">{ai.unknowns.slice(0, 5).map((item, index) => <li key={index}>• {item}</li>)}</ul></div>}</div>
              </div> : <div className="mt-6 rounded-2xl border border-white/[.08] bg-black/20 p-4"><div className="text-xs text-white/35">AI analysis is unavailable because Vantage does not yet have enough trustworthy source text for this listing.</div>{requirements.length > 0 && <ul className="mt-3 grid gap-2 text-sm text-white/55 md:grid-cols-2">{requirements.slice(0, 10).map((item, index) => <li key={index}>• {item}</li>)}</ul>}</div>}

              <div className="mt-5 flex flex-col gap-3 border-t border-white/[.07] pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs text-white/30">{job.companyDomain ? `Employer source: ${job.companyDomain}` : "Employer source not established"}{job.sourceName?.toLowerCase().includes("adzuna") && <span className="ml-2">· Jobs by Adzuna</span>}</div><div className="flex flex-wrap gap-2">{applicationUrl && <a href={applicationUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-white/90">Open application</a>}{!applicationUrl && job.companyWebsite && <a href={job.companyWebsite} target="_blank" rel="noreferrer" className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-medium text-white/70 hover:border-white/30">Visit employer</a>}{!applicationUrl && !job.companyWebsite && <span className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/30">Application path not established</span>}</div></div>
              <div className="mt-3 text-[11px] text-white/25">Vantage will never turn a third-party job-board redirect into an employer application link. Public-source research must establish the destination first.</div>
            </div>
          </article>; })}
        </div>
      </section>}
    </div>
  </main>;
}
