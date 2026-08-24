"use client";

import { FormEvent, useState } from "react";

function listOrFallback(value: unknown, fallback: string) {
  return Array.isArray(value) && value.length ? value as string[] : [fallback];
}

export default function IntelligencePage() {
  const [leadId, setLeadId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!leadId.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/intelligence/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: leadId.trim() }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "AI analysis is unavailable.");
      setResult(payload?.intelligence ?? null);
    } catch (err) { setError(err instanceof Error ? err.message : "AI analysis failed."); }
    finally { setLoading(false); }
  }

  const accepted = result?.validationStatus === "supported";
  const opportunityLevel = typeof result?.opportunityLevel === "string" ? result.opportunityLevel : "review needed";
  const summary = typeof result?.businessSummary === "string" ? result.businessSummary : "No summary available yet.";
  const strengths = listOrFallback(result?.strengths, "No supported strengths identified.");
  const opportunities = listOrFallback(result?.opportunities, "No supported opportunity identified yet.");
  const unknowns = listOrFallback(result?.unknowns, "No explicit unknowns recorded.");
  const nextSteps = listOrFallback(result?.recommendedServices, "Run deeper research before taking action.");

  return <div className="space-y-6">
    <header><p className="text-[10px] uppercase tracking-[0.22em] text-accent font-mono">Research copilot</p><h1 className="text-2xl font-extrabold font-mono tracking-tight mt-1">Intelligence</h1><p className="text-sm text-subtle mt-1 max-w-2xl">Turn saved research into a clear conclusion, evidence gap, and next action. The underlying research machinery stays behind the product.</p></header>
    <section className="grid gap-4 md:grid-cols-3"><article className="rounded-xl border border-border bg-surface p-5"><p className="text-[10px] uppercase font-mono text-accent">01 · Understand</p><h2 className="font-semibold mt-2">Explain what matters</h2><p className="text-xs text-subtle mt-2 leading-5">Summarize the strongest evidence and separate what is known from interpretation.</p></article><article className="rounded-xl border border-border bg-surface p-5"><p className="text-[10px] uppercase font-mono text-accent">02 · Find gaps</p><h2 className="font-semibold mt-2">Spot what is missing</h2><p className="text-xs text-subtle mt-2 leading-5">Show the unknowns that still need evidence before a decision is safe.</p></article><article className="rounded-xl border border-border bg-surface p-5"><p className="text-[10px] uppercase font-mono text-accent">03 · Act</p><h2 className="font-semibold mt-2">Choose the next move</h2><p className="text-xs text-subtle mt-2 leading-5">Recommend a bounded validation step instead of forcing certainty.</p></article></section>
    <section className="rounded-xl border border-accent/30 bg-accent/5 p-5 sm:p-6"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded-lg border border-accent/40 bg-accent/10 flex items-center justify-center text-accent font-mono font-bold">AI</div><div><h2 className="font-semibold">Analyze a saved business</h2><p className="text-xs text-subtle mt-1">Use a saved business reference from your workspace.</p></div></div><form onSubmit={analyze} className="mt-5 flex flex-col sm:flex-row gap-2"><input value={leadId} onChange={(event) => setLeadId(event.target.value)} placeholder="Saved business reference" className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" /><button type="submit" disabled={loading || !leadId.trim()} className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50">{loading ? "Analyzing…" : "Analyze"}</button></form>{error && <div className="mt-4 rounded-lg border border-danger/40 bg-danger/5 p-3 text-xs">{error}</div>}</section>
    {result && <section className="rounded-xl border border-border bg-surface p-5 space-y-6"><div className={`rounded-lg border p-4 ${accepted ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}`}><div className="text-[10px] uppercase font-mono text-subtle">Research confidence</div><h2 className="font-semibold mt-1">{accepted ? "Conclusion supported by available evidence" : "Conclusion needs more evidence"}</h2><p className="text-xs text-subtle mt-1">{typeof result.confidence === "number" ? `Confidence ${result.confidence}%` : "Confidence not available"}</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="border border-border rounded-lg p-4"><div className="text-[10px] uppercase font-mono text-subtle">AI conclusion</div><div className="text-xl font-mono font-extrabold mt-2">{accepted ? opportunityLevel.toUpperCase() : "NOT ACCEPTED"}</div><p className="text-xs text-subtle mt-1">{accepted ? "An interpretation of the evidence." : "Run deeper research before relying on this conclusion."}</p></div><div className="border border-border rounded-lg p-4"><div className="text-[10px] uppercase font-mono text-subtle">Business summary</div><p className="text-sm mt-2 leading-6">{summary}</p></div></div><div className="grid gap-5 md:grid-cols-2"><div><h3 className="text-[10px] uppercase font-mono text-subtle mb-2">What looks promising</h3><ul className="space-y-2 text-sm text-subtle">{strengths.map((item) => <li key={item}>• {item}</li>)}</ul></div><div><h3 className="text-[10px] uppercase font-mono text-subtle mb-2">Opportunity signals</h3><ul className="space-y-2 text-sm text-subtle">{opportunities.map((item) => <li key={item}>• {item}</li>)}</ul></div><div><h3 className="text-[10px] uppercase font-mono text-subtle mb-2">Still unknown</h3><ul className="space-y-2 text-sm text-subtle">{unknowns.map((item) => <li key={item}>• {item}</li>)}</ul></div><div><h3 className="text-[10px] uppercase font-mono text-subtle mb-2">Recommended next step</h3><ul className="space-y-2 text-sm text-subtle">{nextSteps.map((item) => <li key={item}>• {item}</li>)}</ul></div></div>{typeof result.reasoning === "string" && <div><h3 className="text-[10px] uppercase font-mono text-subtle mb-2">Why VANTAGE says this</h3><p className="text-sm text-subtle leading-6">{result.reasoning.split("\n\nProvider attempts:")[0]}</p></div>}</section>}
  </div>;
}
