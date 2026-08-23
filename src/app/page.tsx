import Link from "next/link";
import { MOCK_LEADS, MOCK_OVERVIEW_STATS } from "@/data/mockData";
import { formatDomain, formatNumber } from "@/lib/utils";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PipelineStageBar } from "@/components/features/PipelineStageBar";
import { MOCK_DATA_DISCLAIMER, PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/lib/constants";
import { getScoreTier, SCORE_TIER_META } from "@/lib/score";

export default function DashboardPage() {
  const stats = MOCK_OVERVIEW_STATS;
  const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = MOCK_LEADS.filter((l) => l.status === stage).length;
    return acc;
  }, {} as Record<string, number>);
  const topOpportunities = [...MOCK_LEADS].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">VANTAGE Dashboard</h1>
          <p className="text-sm text-subtle mt-1 max-w-2xl">Real-time intelligence on high-opportunity business prospects lacking modern digital experiences.</p>
        </div>
        <Link
          href="/discover"
          className="inline-flex items-center justify-center h-11 px-5 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 font-medium transition-all shadow-sm font-semibold"
        >
          Discover Leads
        </Link>
      </section>

      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Businesses Discovered" value={formatNumber(stats.businessesDiscovered)} subtitle="Total tracked prospects across sources" />
          <StatCard title="Websites Analyzed" value={formatNumber(stats.websitesAnalyzed)} subtitle="Performance + health scans completed" />
          <StatCard title="High-Opportunity Leads" value={formatNumber(stats.highOpportunityLeads)} subtitle="Score ≥ 80 with clear upside" />
          <StatCard title="Active Automations" value={stats.activeAutomations} subtitle="Scanners running on schedule" />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 space-y-3">
          <PipelineStageBar counts={stageCounts} />
          <div className="border border-border rounded-lg bg-surface/50 overflow-hidden">
            <table className="w-full text-xs font-mono"><thead className="bg-surface-2/50"><tr><th className="text-left px-3 py-2 text-[10px] font-medium text-subtle uppercase">Stage</th><th className="text-right px-3 py-2 text-[10px] font-medium text-subtle uppercase">Leads</th></tr></thead><tbody className="divide-y divide-border">{PIPELINE_STAGES.map((stage) => <tr key={stage} className="hover:bg-surface-2/30"><td className="px-3 py-2 text-xs text-foreground">{PIPELINE_STAGE_LABELS[stage]}</td><td className="px-3 py-2 text-right font-mono font-bold text-foreground tabular">{stageCounts[stage] ?? 0}</td></tr>)}</tbody></table>
          </div>
          <div className="p-3 border border-dashed border-border rounded-lg bg-surface/30"><p className="text-[10px] text-subtle text-center">{MOCK_DATA_DISCLAIMER}</p></div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold text-foreground font-mono uppercase tracking-wider">Top Opportunities</h2><Link href="/leads" className="text-xs text-accent hover:underline font-mono">View all →</Link></div>
          <div className="border border-border rounded-lg bg-surface/50 overflow-hidden">
            <table className="w-full text-xs font-mono"><thead className="bg-surface-2/50"><tr><th className="text-left px-3 py-2 text-[10px] font-medium text-subtle uppercase">Business</th><th className="text-left px-3 py-2 text-[10px] font-medium text-subtle uppercase">Category</th><th className="text-left px-3 py-2 text-[10px] font-medium text-subtle uppercase">Location</th><th className="text-left px-3 py-2 text-[10px] font-medium text-subtle uppercase">Website</th><th className="text-center px-3 py-2 text-[10px] font-medium text-subtle uppercase">Score</th><th className="text-center px-3 py-2 text-[10px] font-medium text-subtle uppercase">Status</th></tr></thead><tbody className="divide-y divide-border">{topOpportunities.map((lead) => { const tier = getScoreTier(lead.opportunityScore); const meta = SCORE_TIER_META[tier]; return (<tr key={lead.id} className="hover:bg-surface-2/30 group"><td className="px-3 py-2.5 align-top"><Link href={`/leads/${lead.id}`} className="font-medium text-foreground group-hover:text-accent transition-colors">{lead.business.name}</Link></td><td className="px-3 py-2.5 text-subtle align-top">{lead.business.category}</td><td className="px-3 py-2.5 text-subtle align-top">{lead.business.location.city}, {lead.business.location.country}</td><td className="px-3 py-2.5 align-top">{lead.business.website ? <a href={lead.business.website} target="_blank" rel="noopener noreferrer" className="text-accent font-mono hover:underline">{formatDomain(lead.business.website)}</a> : <span className="text-xs text-subtle">No website</span>}</td><td className="px-3 py-2.5 align-top text-center"><span className={meta.text}>{lead.opportunityScore}</span></td><td className="px-3 py-2.5 align-top text-center"><StatusBadge type="stage" value={lead.status} /></td></tr>); })}</tbody></table>
          </div>
        </div>
      </div>

      <div className="border border-info/30 bg-info/5 rounded-lg p-3 flex items-start gap-2"><p className="text-xs text-info"><span className="font-semibold">Phase 1 Preview</span> — {MOCK_DATA_DISCLAIMER}</p></div>
    </div>
  );
}