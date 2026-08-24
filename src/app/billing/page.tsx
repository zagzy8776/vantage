"use client";

import Link from "next/link";

const plans = [
  { name: "Free", description: "Try VANTAGE research with a small monthly allowance.", tone: "Standard" },
  { name: "Pro", description: "More research runs for people doing regular market work.", tone: "Popular" },
  { name: "Researcher", description: "Higher research capacity for professional investigations.", tone: "Professional" },
  { name: "Lifetime", description: "A one-time research-credit package when you do not want a subscription.", tone: "One-time" },
];

export default function BillingPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <Link href="/settings" className="text-xs text-accent hover:underline">← Settings</Link>
        <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-mono mt-3">Research economics</p>
        <h1 className="text-2xl font-mono font-extrabold tracking-tight">Usage & Billing</h1>
        <p className="text-sm text-subtle max-w-2xl">Research credits will map directly to persisted Search Runs. Failed or cancelled work can be reconciled without pretending it was a successful search.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5"><p className="text-[10px] uppercase font-mono text-subtle">Research credits</p><p className="text-3xl font-mono font-extrabold mt-2">—</p><p className="text-xs text-subtle mt-1">Live entitlement not connected yet.</p></div>
        <div className="rounded-xl border border-border bg-surface p-5"><p className="text-[10px] uppercase font-mono text-subtle">Used this period</p><p className="text-3xl font-mono font-extrabold mt-2">—</p><p className="text-xs text-subtle mt-1">Will be calculated from persisted runs.</p></div>
        <div className="rounded-xl border border-border bg-surface p-5"><p className="text-[10px] uppercase font-mono text-subtle">Provider cost</p><p className="text-3xl font-mono font-extrabold mt-2">Private</p><p className="text-xs text-subtle mt-1">Internal operator metric, never a customer-facing provider bill.</p></div>
      </section>

      <section>
        <div className="mb-3"><h2 className="font-semibold">Choose how you want to research</h2><p className="text-xs text-subtle mt-1">Plans are presented now; payment activation is intentionally separate from entitlement accounting.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <article key={plan.name} className="rounded-xl border border-border bg-surface p-5 hover:border-accent/40 transition-colors">
              <div className="flex items-center justify-between gap-2"><h3 className="font-mono font-bold">{plan.name}</h3><span className="text-[9px] uppercase font-mono text-accent">{plan.tone}</span></div>
              <p className="text-xs text-subtle leading-5 mt-3 min-h-16">{plan.description}</p>
              <button type="button" disabled className="w-full mt-5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-subtle cursor-not-allowed">Available when billing is connected</button>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">What we track</h2>
        <div className="grid gap-3 md:grid-cols-3 mt-4 text-xs">
          <div className="rounded-lg bg-surface-2/50 p-3"><b>Search Runs</b><p className="text-subtle mt-1">Every scan has a durable usage record.</p></div>
          <div className="rounded-lg bg-surface-2/50 p-3"><b>Research usage</b><p className="text-subtle mt-1">Business, web, verification and analysis work can be measured separately.</p></div>
          <div className="rounded-lg bg-surface-2/50 p-3"><b>Hard limits</b><p className="text-subtle mt-1">Future plans will reserve capacity before expensive research begins.</p></div>
        </div>
      </section>
    </div>
  );
}
