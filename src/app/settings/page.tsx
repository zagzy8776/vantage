"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const PREF_KEY = "vantage-ui-preferences";

type Preferences = {
  researchComplete: boolean;
  researchErrors: boolean;
  weeklyDigest: boolean;
  compactResults: boolean;
};

const defaults: Preferences = {
  researchComplete: true,
  researchErrors: true,
  weeklyDigest: false,
  compactResults: false,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-accent" : "bg-surface-3 border border-border-strong"}`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) setPrefs({ ...defaults, ...JSON.parse(raw) });
    } catch {
      // Keep safe defaults when local storage is unavailable.
    }
  }, []);

  const update = (key: keyof Preferences, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch {
      // Preferences remain usable for this session.
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-mono">Workspace control</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-mono font-extrabold tracking-tight">Settings</h1>
            <p className="text-sm text-subtle mt-1">Control how VANTAGE researches, not how the research itself is trusted.</p>
          </div>
          {saved && <span className="text-xs text-success font-mono">Saved locally</span>}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold">Research experience</h2>
            <p className="text-xs text-subtle mt-1">Small preferences that make long investigations easier to follow.</p>
          </div>
          <div className="space-y-5">
            <label className="flex items-center justify-between gap-4">
              <span><span className="block text-sm font-medium">Research completed</span><span className="block text-xs text-subtle mt-0.5">Show a notification when a saved scan finishes.</span></span>
              <Toggle checked={prefs.researchComplete} onChange={(v) => update("researchComplete", v)} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span><span className="block text-sm font-medium">Research issues</span><span className="block text-xs text-subtle mt-0.5">Alert when a scan finishes with provider issues.</span></span>
              <Toggle checked={prefs.researchErrors} onChange={(v) => update("researchErrors", v)} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span><span className="block text-sm font-medium">Compact result cards</span><span className="block text-xs text-subtle mt-0.5">Fit more businesses on screen while scanning.</span></span>
              <Toggle checked={prefs.compactResults} onChange={(v) => update("compactResults", v)} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span><span className="block text-sm font-medium">Weekly research digest</span><span className="block text-xs text-subtle mt-0.5">Prepare a weekly summary of your saved research.</span></span>
              <Toggle checked={prefs.weeklyDigest} onChange={(v) => update("weeklyDigest", v)} />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold">Usage & billing</h2>
            <p className="text-xs text-subtle mt-1">Research is measured in runs so you can understand what you consume.</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-2/50 p-4">
            <div className="flex items-center justify-between"><span className="text-xs text-subtle uppercase font-mono">Current plan</span><span className="text-xs font-mono font-semibold">Account plan</span></div>
            <p className="text-sm text-subtle mt-3">Your live entitlement and usage will be shown here once billing is connected.</p>
            <Link href="/billing" className="inline-flex mt-4 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:opacity-90">View usage & plans</Link>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-5"><h2 className="font-semibold">Notifications</h2><p className="text-xs text-subtle mt-1">VANTAGE will keep operational alerts separate from research evidence.</p></div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-border p-3"><span className="h-2 w-2 rounded-full bg-success" /><div><p className="text-sm font-medium">Research updates</p><p className="text-xs text-subtle">Completion and partial-failure alerts.</p></div></div>
            <div className="flex items-center gap-3 rounded-lg border border-border p-3"><span className="h-2 w-2 rounded-full bg-accent" /><div><p className="text-sm font-medium">Change detection</p><p className="text-xs text-subtle">Monitoring alerts when reviewed evidence changes.</p></div></div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-5"><h2 className="font-semibold">Research privacy</h2><p className="text-xs text-subtle mt-1">Provider internals and operational diagnostics stay outside the customer experience.</p></div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-border pb-3"><span className="text-subtle">Research history</span><span className="font-medium">Saved to your workspace</span></div>
            <div className="flex justify-between border-b border-border pb-3"><span className="text-subtle">Provider credentials</span><span className="font-medium">Never customer-visible</span></div>
            <div className="flex justify-between"><span className="text-subtle">Evidence trail</span><span className="font-medium">Traceable</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}
