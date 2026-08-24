"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AutomationsPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = window.setTimeout(() => setReady(true), 0); return () => window.clearTimeout(id); }, []);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-mono">Research workflows</p>
        <h1 className="text-2xl font-extrabold font-mono mt-1">Automations</h1>
        <p className="text-sm text-subtle mt-1 max-w-2xl">Schedule recurring discovery scans and follow-up actions. VANTAGE will show only persisted automations here — never demo records.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4"><p className="text-[10px] font-mono text-accent uppercase">Trigger</p><h2 className="font-semibold mt-2">Location scans</h2><p className="text-xs text-subtle mt-1">Revisit cities and categories on a schedule.</p></div>
        <div className="rounded-xl border border-border bg-surface p-4"><p className="text-[10px] font-mono text-accent uppercase">Signal</p><h2 className="font-semibold mt-2">Change detection</h2><p className="text-xs text-subtle mt-1">Alert when evidence or opportunity signals change.</p></div>
        <div className="rounded-xl border border-border bg-surface p-4"><p className="text-[10px] font-mono text-accent uppercase">Action</p><h2 className="font-semibold mt-2">AI follow-up</h2><p className="text-xs text-subtle mt-1">Ask VANTAGE to reassess and suggest the next step.</p></div>
      </section>

      {ready && <section className="rounded-xl border border-dashed border-border bg-surface p-8">
        <EmptyState title="No automations configured" description="Your workspace has no saved automation schedules yet. Start with a discovery scan; scheduled workflows will be attached to real research state instead of showing placeholder automations." />
        <div className="flex justify-center mt-5"><Link href="/discover" className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-xs font-semibold hover:opacity-90">Start a research scan</Link></div>
      </section>}
    </div>
  );
}
