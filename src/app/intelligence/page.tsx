"use client";

import { FormEvent, useState } from "react";

export default function IntelligencePage() {
  const [leadId, setLeadId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!leadId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/intelligence/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: leadId.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "AI analysis is unavailable.");
      setResult(payload?.intelligence ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-mono">Research copilot</p>
        <h1 className="text-2xl font-extrabold font-mono tracking-tight mt-1">Intelligence</h1>
        <p className="text-sm text-subtle mt-1 max-w-2xl">VANTAGE AI turns research into the next useful question, evidence gap, and action. It explains the work; it does not replace the evidence.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-surface p-5"><p className="text-[10px] uppercase font-mono text-accent">01 · Understand</p><h2 className="font-semibold mt-2">Explain what matters</h2><p className="text-xs text-subtle mt-2 leading-5">Summarize the strongest evidence and separate facts from interpretation.</p></article>
        <article className="rounded-xl border border-border bg-surface p-5"><p className="text-[10px] uppercase font-mono text-accent">02 · Find gaps</p><h2 className="font-semibold mt-2">Spot what is missing</h2><p className="text-xs text-subtle mt-2 leading-5">Identify unknowns and tell you what evidence would reduce uncertainty.</p></article>
        <article className="rounded-xl border border-border bg-surface p-5"><p className="text-[10px] uppercase font-mono text-accent">03 · Act</p><h2 className="font-semibold mt-2">Recommend the next move</h2><p className="text-xs text-subtle mt-2 leading-5">Suggest a bounded next research step instead of inventing certainty.</p></article>
      </section>

      <section className="rounded-xl border border-accent/30 bg-accent/5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg border border-accent/40 bg-accent/10 flex items-center justify-center text-accent font-mono font-bold">AI</div>
          <div><h2 className="font-semibold">Ask VANTAGE to analyze a saved lead</h2><p className="text-xs text-subtle mt-1">Use a lead ID from a saved research result. The existing protected AI route performs the analysis.</p></div>
        </div>
        <form onSubmit={analyze} className="mt-5 flex flex-col sm:flex-row gap-2">
          <input value={leadId} onChange={(event) => setLeadId(event.target.value)} placeholder="Paste lead ID" className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
          <button type="submit" disabled={loading || !leadId.trim()} className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50">{loading ? "Analyzing…" : "Analyze with AI"}</button>
        </form>
        {error && <div className="mt-4 rounded-lg border border-danger/40 bg-danger/5 p-3 text-xs">{error}</div>}
      </section>

      {result && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase font-mono text-accent">AI output</p><h2 className="font-semibold mt-1">Analysis ready</h2></div><span className="text-[10px] uppercase font-mono text-subtle">Evidence-backed workflow</span></div>
          <pre className="mt-4 overflow-auto rounded-lg bg-background border border-border p-4 text-xs leading-5 text-subtle whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
