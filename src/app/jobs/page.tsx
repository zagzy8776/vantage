"use client";

import { FormEvent, useMemo, useState } from "react";

type Job = {
  id: string; title: string; companyName: string; location?: string; countryCode?: string;
  employmentType?: string; remote?: boolean; salaryMin?: number; salaryMax?: number;
  salaryCurrency?: string; postedAt?: string; applyUrl?: string; sourceName?: string;
  verificationStatus: "verified" | "needs_verification" | "unverified";
  verificationScore: number; verificationReasons: string[];
};

type SearchResponse = { jobs: Job[]; providers: { provider: string; status: string; count: number }[]; error?: string };

const statusCopy = { verified: "Direct employer verified", needs_verification: "Verification in progress", unverified: "Source found" } as const;
const countries = [
  ["US", "United States"], ["NG", "Nigeria"], ["GB", "United Kingdom"], ["CA", "Canada"],
  ["DE", "Germany"], ["AU", "Australia"], ["FR", "France"], ["NL", "Netherlands"], ["IE", "Ireland"], ["ZA", "South Africa"],
] as const;

function money(job: Job) {
  if (job.salaryMin == null && job.salaryMax == null) return "Salary not disclosed";
  const currency = job.salaryCurrency ?? "USD";
  const format = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  if (job.salaryMin != null && job.salaryMax != null) return `${format(job.salaryMin)} – ${format(job.salaryMax)}`;
  return format(job.salaryMin ?? job.salaryMax!);
}

function timeAgo(value?: string) {
  if (!value) return "Posting date unavailable";
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return "Posting date unavailable";
  const diff = Math.max(0, Date.now() - parsed);
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Posted just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

function Icon({ name }: { name: "search" | "pin" | "briefcase" | "shield" | "arrow" | "clock" | "spark" }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
  if (name === "pin") return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
  if (name === "briefcase") return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>;
  if (name === "spark") return <svg {...common}><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></svg>;
  return <svg {...common}><path d="M5 12h13M13 7l5 5-5 5"/></svg>;
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
  const [directOnly, setDirectOnly] = useState(true);

  const visibleJobs = useMemo(() => {
    if (!data) return [];
    return directOnly ? data.jobs.filter((job) => job.verificationStatus !== "unverified") : data.jobs;
  }, [data, directOnly]);
  const verifiedCount = useMemo(() => data?.jobs.filter((j) => j.verificationStatus === "verified").length ?? 0, [data]);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (!title.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/jobs/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), city: location.trim() || undefined, country: countries.find(([code]) => code === country)?.[1], countryCode: country, remote, postedWithinDays: Number(days), limit: 30 }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      setData(body);
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed"); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#06080c] text-white selection:bg-white selection:text-black">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.08),transparent_58%)]" />
      <div className="relative mx-auto max-w-[1440px] px-5 pb-16 pt-7 md:px-8 md:pt-10">
        <header className="mb-9 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Vantage / Opportunity intelligence</div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-[-.045em] md:text-[44px] md:leading-[1.05]">Find the jobs that are actually hiring.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/45 md:text-[15px]">Vantage searches multiple job markets, then works back toward the employer and original source. No invented vacancies. No paid placement disguised as a job.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-3 py-2 text-xs text-white/45 md:flex"><Icon name="shield" />Evidence-first search</div>
        </header>

        <form onSubmit={search} className="rounded-[22px] border border-white/10 bg-white/[.035] p-2 shadow-[0_24px_80px_rgba(0,0,0,.28)] backdrop-blur-xl md:p-3">
          <div className="grid gap-2 md:grid-cols-[1.55fr_1fr_170px_auto]">
            <label className="group flex min-h-[64px] items-center gap-3 rounded-[15px] border border-white/10 bg-black/20 px-4 transition focus-within:border-white/25 focus-within:bg-white/[.04]"><span className="text-white/35"><Icon name="search" /></span><span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Role or skill</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Software engineer, accountant..." className="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-white/20" /></span></label>
            <label className="group flex min-h-[64px] items-center gap-3 rounded-[15px] border border-white/10 bg-black/20 px-4 transition focus-within:border-white/25 focus-within:bg-white/[.04]"><span className="text-white/35"><Icon name="pin" /></span><span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or region" className="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-white/20" /></span></label>
            <label className="flex min-h-[64px] items-center gap-3 rounded-[15px] border border-white/10 bg-black/20 px-4"><span className="text-white/35"><Icon name="briefcase" /></span><span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Country</span><select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full bg-transparent text-sm outline-none"><option className="bg-[#0b0e13]" value="US">United States</option>{countries.filter(([code]) => code !== "US").map(([code, name]) => <option key={code} className="bg-[#0b0e13]" value={code}>{name}</option>)}</select></span></label>
            <button type="submit" disabled={loading || !title.trim()} className="min-h-[64px] rounded-[15px] bg-white px-7 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35">{loading ? "Searching…" : "Search jobs"}</button>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-3 pb-1 pt-3 text-xs text-white/45">
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={directOnly} onChange={(e) => setDirectOnly(e.target.checked)} className="h-3.5 w-3.5 accent-white" /> Direct-employer results</label>
            <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="h-3.5 w-3.5 accent-white" /> Remote only</label>
            <label className="flex items-center gap-2">Freshness <select value={days} onChange={(e) => setDays(e.target.value)} className="bg-transparent font-medium text-white/65 outline-none"><option className="bg-[#0b0e13]" value="1">24 hours</option><option className="bg-[#0b0e13]" value="7">7 days</option><option className="bg-[#0b0e13]" value="30">30 days</option><option className="bg-[#0b0e13]" value="90">90 days</option></select></label>
            <span className="ml-auto hidden items-center gap-1.5 md:flex"><Icon name="spark" /> Powered by multiple discovery sources</span>
          </div>
        </form>

        {error && <div role="alert" className="mt-5 flex items-center justify-between rounded-2xl border border-red-400/20 bg-red-400/[.06] px-4 py-3 text-sm text-red-200"><span>{error}</span><button onClick={() => search()} className="text-xs font-medium underline underline-offset-4">Retry</button></div>}

        {!data && !loading && <section className="mx-auto mt-20 max-w-3xl text-center md:mt-28"><div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-[20px] border border-white/10 bg-white/[.04] text-white/65 shadow-xl"><Icon name="search" /></div><h2 className="text-xl font-medium tracking-[-.02em]">Search the real job market</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/38">Start with a role and country. Vantage uses several discovery sources, then separates what has been verified from what still needs evidence.</p><div className="mt-7 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => { setTitle("Software engineer"); setCountry("NG"); }} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/45 transition hover:border-white/20 hover:text-white/75">Software engineer · Nigeria</button><button type="button" onClick={() => { setTitle("Data analyst"); setCountry("GB"); }} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/45 transition hover:border-white/20 hover:text-white/75">Data analyst · UK</button><button type="button" onClick={() => { setTitle("Frontend developer"); setRemote(true); }} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/45 transition hover:border-white/20 hover:text-white/75">Frontend · Remote</button></div></section>}

        {loading && <div className="mt-8 space-y-3" aria-label="Loading jobs">{[1,2,3,4].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/[.07] bg-white/[.025]" />)}</div>}

        {data && !loading && <section className="mt-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/30">Market results</div><div className="mt-1 flex items-center gap-3"><h2 className="text-lg font-medium tracking-[-.02em]">{visibleJobs.length} opportunities</h2><span className="text-xs text-emerald-300/70">{verifiedCount} directly verified</span></div></div><div className="flex flex-wrap gap-1.5">{data.providers.map((p) => <span key={p.provider} title={`${p.provider}: ${p.status}`} className="rounded-full border border-white/[.08] bg-white/[.025] px-2.5 py-1.5 text-[10px] text-white/35">{p.provider} <span className="text-white/20">·</span> {p.count}</span>)}</div></div>
          <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[.018]">
            {visibleJobs.length === 0 ? <div className="p-14 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/[.035] text-white/45"><Icon name="search" /></div><h3 className="mt-4 text-sm font-medium">No verified opportunities yet</h3><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-white/35">Broaden the role or location, or turn off the direct-employer filter to inspect discovered listings that still need verification.</p></div> : visibleJobs.map((job) => <article key={job.id} className="group border-b border-white/[.07] p-5 transition hover:bg-white/[.035] last:border-0 md:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold tracking-[-.015em] md:text-[17px]">{job.title}</h3><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${job.verificationStatus === "verified" ? "border-emerald-400/20 bg-emerald-400/[.08] text-emerald-300" : job.verificationStatus === "needs_verification" ? "border-amber-400/20 bg-amber-400/[.07] text-amber-300" : "border-white/10 bg-white/[.035] text-white/40"}`}>{job.verificationStatus === "verified" && <Icon name="shield" />}{statusCopy[job.verificationStatus]}</span></div><div className="mt-2 text-sm text-white/65">{job.companyName}<span className="px-2 text-white/15">·</span>{job.location ?? "Location unavailable"}</div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/35"><span className="inline-flex items-center gap-1.5"><Icon name="briefcase" />{job.remote ? "Remote" : job.employmentType ?? "Employment type unavailable"}</span><span>{money(job)}</span><span className="inline-flex items-center gap-1.5"><Icon name="clock" />{timeAgo(job.postedAt)}</span><span>{job.sourceName ?? job.id.split(":")[0]}</span></div></div><div className="flex shrink-0 items-center gap-3"><div className="hidden text-right sm:block"><div className="text-[10px] uppercase tracking-[.15em] text-white/25">Evidence score</div><div className="mt-1 text-sm font-medium text-white/65">{job.verificationScore}/100</div></div>{job.applyUrl ? <a href={job.applyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:-translate-y-0.5 hover:bg-white/90">Open application <Icon name="arrow" /></a> : <span className="text-xs text-white/25">No application link</span>}</div></div><div className="mt-4 flex items-start gap-2 border-t border-white/[.06] pt-3 text-[11px] leading-5 text-white/30"><span className="mt-0.5 text-white/25"><Icon name="shield" /></span><span>{job.verificationReasons?.[0] ?? "Verification evidence is still being collected."}</span></div></article>)}
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] leading-5 text-white/25"><Icon name="shield" />Vantage labels evidence honestly. A discovered listing is not presented as a verified direct employer until the employer relationship is established.</div>
        </section>}
      </div>
    </main>
  );
}
