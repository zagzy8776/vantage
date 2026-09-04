"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Job = Record<string, unknown> & { id: string; title: string; companyName: string; verificationStatus: string; verificationScore?: number; verificationReasons?: string[]; verificationEvidence?: { url: string; reason: string }[] };

function value(job: Job, key: string) { const v = job[key]; return v == null || v === "" ? "Not disclosed" : String(v); }

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch(`/api/jobs/${encodeURIComponent(params.id)}`).then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error ?? "Unable to load job"); setJob(b.job); }).catch((e) => setError(e instanceof Error ? e.message : "Unable to load job")); }, [params.id]);

  async function save(status = "saved") { setSaving(true); try { const r = await fetch(`/api/jobs/${encodeURIComponent(params.id)}/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); if (!r.ok) throw new Error("Unable to save job"); } catch (e) { setError(e instanceof Error ? e.message : "Unable to save job"); } finally { setSaving(false); } }

  if (error && !job) return <main className="min-h-screen bg-[#06080c] p-8 text-white"><div className="mx-auto max-w-3xl rounded-2xl border border-red-400/20 bg-red-400/[.06] p-6 text-sm text-red-200">{error}</div></main>;
  if (!job) return <main className="min-h-screen bg-[#06080c] p-8 text-white"><div className="mx-auto max-w-3xl animate-pulse space-y-4"><div className="h-12 rounded-xl bg-white/[.05]"/><div className="h-64 rounded-2xl bg-white/[.04]"/></div></main>;

  const verified = job.verificationStatus === "direct_employer_verified";
  return <main className="min-h-screen bg-[#06080c] text-white"><div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
    <div className="mb-8 text-[10px] font-semibold uppercase tracking-[.2em] text-white/30">Vantage / Job intelligence</div>
    <section className="rounded-[28px] border border-white/10 bg-white/[.035] p-6 shadow-2xl md:p-9">
      <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between"><div><span className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] ${verified ? "border-emerald-400/20 bg-emerald-400/[.08] text-emerald-300" : "border-amber-400/20 bg-amber-400/[.06] text-amber-200"}`}>{verified ? "Direct employer verified" : "Needs verification"}</span><h1 className="mt-5 text-3xl font-semibold tracking-[-.04em] md:text-5xl">{job.title}</h1><p className="mt-3 text-base text-white/55">{job.companyName} · {value(job, "location")}</p></div><div className="flex gap-2"><button disabled={saving} onClick={() => save()} className="rounded-xl border border-white/10 bg-white/[.05] px-4 py-3 text-sm hover:bg-white/[.09] disabled:opacity-40">{saving ? "Saving…" : "Save opportunity"}</button>{typeof job.applyUrl === "string" && <a href={job.applyUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90">Original listing ↗</a>}</div></div>
      <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Employment", value(job, "employmentType")],["Work mode", job.remote === true ? "Remote" : "On-site / unspecified"],["Salary", value(job, "salaryMin") !== "Not disclosed" ? `${value(job, "salaryMin")} – ${value(job, "salaryMax")}` : "Not disclosed"],["Posted", value(job, "postedAt")] ].map(([k,v]) => <div key={k} className="rounded-2xl border border-white/[.07] bg-black/20 p-4"><div className="text-[10px] uppercase tracking-[.16em] text-white/25">{k}</div><div className="mt-2 text-sm text-white/75">{v}</div></div>)}</div>
    </section>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <section className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><h2 className="text-sm font-semibold">Description</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/55">{value(job, "description")}</p></section>
      <section className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Verification</h2><span className="text-lg font-semibold">{job.verificationScore ?? 0}<span className="text-xs text-white/25"> / 100</span></span></div><div className="mt-4 space-y-2">{(job.verificationReasons ?? []).map((reason) => <div key={reason} className="rounded-xl bg-white/[.035] p-3 text-xs leading-5 text-white/50">{reason}</div>)}</div>{(job.verificationEvidence ?? []).length > 0 && <div className="mt-5 border-t border-white/[.07] pt-5"><div className="mb-3 text-[10px] uppercase tracking-[.16em] text-white/25">Evidence</div>{job.verificationEvidence!.map((e) => <a key={e.url} href={e.url} target="_blank" rel="noreferrer" className="mb-2 block rounded-xl border border-white/[.06] p-3 text-xs text-white/55 hover:bg-white/[.04]">{e.reason}<span className="mt-1 block truncate text-white/25">{e.url}</span></a>)}</div>}</section>
    </div>
  </div></main>;
}
