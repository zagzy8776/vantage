"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OpportunityScore } from "@/components/ui/OpportunityScore";
import { formatDomain, formatDate, initials } from "@/lib/utils";
import type { PipelineStage } from "@/lib/types";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGES } from "@/lib/constants";

interface LiveLead {
  id: string;
  businessId: string;
  name: string;
  category: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  area: string | null;
  street: string | null;
  website: string | null;
  phone: string | null;
  opportunityScore: number;
  status: PipelineStage;
  websiteStatus: "none" | "unknown" | "unreachable" | "poor" | "fair" | "good";
  reason: string;
  lastAnalyzedAt: string | null;
  updatedAt: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LiveLead[]>([]);
  const [stage, setStage] = useState<"all" | PipelineStage>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/leads?limit=200", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Leads are unavailable.");
      setLeads((payload?.leads ?? []) as LiveLead[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Leads are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = stage === "all" ? leads : leads.filter((lead) => lead.status === stage);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-mono">Live pipeline</p>
          <h1 className="text-2xl font-extrabold font-mono mt-1">Leads</h1>
          <p className="text-sm text-subtle mt-1">Real businesses discovered and scored by VANTAGE. No fictional fallback records.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Refresh</button>
          <Link href="/discover" className="rounded-md bg-accent text-accent-foreground px-3 py-2 text-xs font-semibold hover:opacity-90">Find more</Link>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setStage("all")} className={`px-3 py-1.5 rounded text-xs font-mono border ${stage === "all" ? "bg-accent/15 text-accent border-accent/30" : "border-border text-subtle"}`}>All ({leads.length})</button>
        {PIPELINE_STAGES.map((item) => <button key={item} type="button" onClick={() => setStage(item)} className={`px-3 py-1.5 rounded text-xs font-mono border ${stage === item ? "bg-accent/15 text-accent border-accent/30" : "border-border text-subtle"}`}>{PIPELINE_STAGE_LABELS[item]} ({leads.filter((lead) => lead.status === item).length})</button>)}
      </div>

      {loading ? <LoadingState message="Loading live leads..." rows={6} /> : error ? (
        <div className="border border-danger/40 bg-danger/5 rounded-lg p-4 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No live leads yet" description="Run a discovery scan and the businesses you find will appear here." />
      ) : (
        <>
          <div className="hidden lg:block overflow-x-auto border border-border rounded-lg bg-surface/50">
            <table className="w-full min-w-[1000px] text-sm font-mono">
              <thead className="bg-surface-2/50 border-b border-border"><tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-subtle uppercase">Business</th><th className="text-left px-3 py-2 text-xs font-medium text-subtle uppercase">Category</th><th className="text-left px-3 py-2 text-xs font-medium text-subtle uppercase">Location</th><th className="text-left px-3 py-2 text-xs font-medium text-subtle uppercase">Website</th><th className="text-center px-3 py-2 text-xs font-medium text-subtle uppercase">Opportunity</th><th className="text-center px-3 py-2 text-xs font-medium text-subtle uppercase">Health</th><th className="text-center px-3 py-2 text-xs font-medium text-subtle uppercase">Status</th><th className="text-right px-3 py-2 text-xs font-medium text-subtle uppercase">Updated</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {filtered.map((lead) => <tr key={lead.id} className="hover:bg-surface-2/30">
                  <td className="px-3 py-3"><Link href={`/leads/${lead.id}`} className="flex items-center gap-2.5 font-medium hover:text-accent"><span className="w-8 h-8 rounded bg-surface-2 border border-border text-accent flex items-center justify-center text-xs font-bold">{initials(lead.name)}</span>{lead.name}</Link></td>
                  <td className="px-3 py-3 text-subtle">{lead.category ?? "—"}</td>
                  <td className="px-3 py-3 text-subtle">{[lead.city, lead.country].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-3 py-3">{lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{formatDomain(lead.website)}</a> : <span className="text-subtle">No website</span>}</td>
                  <td className="px-3 py-3 text-center"><OpportunityScore score={lead.opportunityScore} size="sm" /></td>
                  <td className="px-3 py-3 text-center"><StatusBadge type="health" value={lead.websiteStatus} /></td>
                  <td className="px-3 py-3 text-center"><StatusBadge type="stage" value={lead.status} /></td>
                  <td className="px-3 py-3 text-right text-xs text-subtle">{formatDate(lead.lastAnalyzedAt ?? lead.updatedAt)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-2">
            {filtered.map((lead) => <Link key={lead.id} href={`/leads/${lead.id}`} className="block border border-border rounded-lg bg-surface p-3 hover:border-accent/40">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="w-8 h-8 rounded bg-surface-2 border border-border text-accent flex items-center justify-center text-xs font-bold">{initials(lead.name)}</span><span className="font-semibold text-sm">{lead.name}</span></div><OpportunityScore score={lead.opportunityScore} size="sm" /></div>
              <div className="mt-2 text-xs text-subtle">{lead.category ?? "—"} · {[lead.city, lead.country].filter(Boolean).join(", ") || "—"}</div>
              <div className="mt-2 flex flex-wrap gap-2"><StatusBadge type="health" value={lead.websiteStatus} /><StatusBadge type="stage" value={lead.status} />{lead.website ? <span className="text-accent text-xs truncate max-w-[220px]">{formatDomain(lead.website)}</span> : <span className="text-xs text-subtle">No website</span>}</div>
            </Link>)}
          </div>
        </>
      )}
    </div>
  );
}
