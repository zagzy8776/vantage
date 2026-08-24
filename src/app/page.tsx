"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PipelineStageBar } from "@/components/features/PipelineStageBar";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/lib/constants";
import { formatDomain, formatNumber } from "@/lib/utils";

type DashboardData = {
  stats: {
    businessesDiscovered: number;
    websitesAnalyzed: number;
    highOpportunityLeads: number;
    activeScans: number;
  };
  stages: Record<string, number>;
  topOpportunities: Array<{
    id: string;
    businessId: string;
    name: string;
    category: string | null;
    country: string | null;
    city: string | null;
    website: string | null;
    opportunityScore: number;
    status: "discovered" | "analyzing" | "qualified" | "contacted" | "replied" | "won";
    websiteStatus: string;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Dashboard data is unavailable.");
      setData(payload as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard data is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <LoadingState type="spinner" message="Loading live workspace intelligence..." />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold font-mono">VANTAGE Dashboard</h1>
        <div className="border border-danger/40 bg-danger/5 rounded-lg p-4 text-sm">{error}</div>
        <button type="button" onClick={() => void load()} className="rounded-md border border-border px-4 py-2 text-xs font-semibold hover:border-accent">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const stageCounts = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, data.stages[stage] ?? 0]));

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-accent font-mono">Live workspace</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono mt-1">VANTAGE Dashboard</h1>
            <p className="text-sm text-subtle mt-1 max-w-2xl">Your real discovery, website analysis and opportunity intelligence — no demo records.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:border-accent">Refresh</button>
            <Link href="/discover" className="inline-flex items-center justify-center rounded-md bg-accent text-accent-foreground px-4 py-2 text-xs font-semibold hover:opacity-90">New scan</Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Businesses Tracked" value={formatNumber(data.stats.businessesDiscovered)} subtitle="Real businesses stored in your research database" />
        <StatCard title="Websites Analyzed" value={formatNumber(data.stats.websitesAnalyzed)} subtitle="Completed website observations" />
        <StatCard title="High-Opportunity Leads" value={formatNumber(data.stats.highOpportunityLeads)} subtitle="Deterministic opportunity score ≥ 80" />
        <StatCard title="Active Scans" value={data.stats.activeScans} subtitle="Discovery jobs currently running" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 space-y-3">
          <PipelineStageBar counts={stageCounts} />
          <div className="border border-border rounded-lg bg-surface/50 overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead className="bg-surface-2/50"><tr><th className="text-left px-3 py-2 text-[10px] font-medium text-subtle uppercase">Stage</th><th className="text-right px-3 py-2 text-[10px] font-medium text-subtle uppercase">Leads</th></tr></thead>
              <tbody className="divide-y divide-border">
                {PIPELINE_STAGES.map((stage) => (
                  <tr key={stage} className="hover:bg-surface-2/30"><td className="px-3 py-2 text-xs text-foreground">{PIPELINE_STAGE_LABELS[stage]}</td><td className="px-3 py-2 text-right font-mono font-bold text-foreground tabular">{stageCounts[stage]}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div><h2 className="text-sm font-semibold text-foreground font-mono uppercase tracking-wider">Top Opportunities</h2><p className="text-xs text-subtle mt-1">Live records from the database.</p></div>
            <Link href="/leads" className="text-xs text-accent hover:underline font-mono">View all →</Link>
          </div>
          {data.topOpportunities.length === 0 ? (
            <EmptyState title="No opportunities yet" description="Run a discovery scan to start building your opportunity pipeline." />
          ) : (
            <div className="border border-border rounded-lg bg-surface/50 overflow-x-auto">
              <table className="w-full min-w-[700px] text-xs font-mono">
                <thead className="bg-surface-2/50"><tr><th className="text-left px-3 py-2 text-[10px] font-medium text-subtle uppercase">Business</th><th className="text-left px-3 py-2 text-[10px] font-medium text-subtle uppercase">Category</th><th className="text-left px-3 py-2 text-[10px] font-medium text-subtle uppercase">Location</th><th className="text-left px-3 py-2 text-[10px] font-medium text-subtle uppercase">Website</th><th className="text-center px-3 py-2 text-[10px] font-medium text-subtle uppercase">Score</th><th className="text-center px-3 py-2 text-[10px] font-medium text-subtle uppercase">Status</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {data.topOpportunities.map((lead) => (
                    <tr key={lead.id} className="hover:bg-surface-2/30 group">
                      <td className="px-3 py-2.5 align-top"><Link href={`/leads/${lead.id}`} className="font-medium text-foreground group-hover:text-accent transition-colors">{lead.name}</Link></td>
                      <td className="px-3 py-2.5 text-subtle align-top">{lead.category ?? "—"}</td>
                      <td className="px-3 py-2.5 text-subtle align-top">{[lead.city, lead.country].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-3 py-2.5 align-top">{lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{formatDomain(lead.website)}</a> : <span className="text-subtle">No website</span>}</td>
                      <td className="px-3 py-2.5 align-top text-center"><span className="text-accent font-bold">{lead.opportunityScore}</span></td>
                      <td className="px-3 py-2.5 align-top text-center"><StatusBadge type="stage" value={lead.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface/50 p-4 flex items-center justify-between gap-4 flex-wrap">
        <div><p className="text-sm font-semibold">Research memory is active</p><p className="text-xs text-subtle mt-1">Every discovery scan is persisted and can be reopened from History.</p></div>
        <Link href="/history" className="text-xs font-semibold text-accent hover:underline">Open research history →</Link>
      </div>
    </div>
  );
}
