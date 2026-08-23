"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { cn, formatDate, formatDomain, initials } from "../../lib/utils";
import { OpportunityScore } from "../ui/OpportunityScore";
import { StatusBadge } from "../ui/StatusBadge";
import { EmptyState } from "../ui/EmptyState";
import { PIPELINE_STAGE_LABELS } from "../../lib/constants";
import { getScoreTier, SCORE_TIER_META } from "../../lib/score";
import type { Lead, PipelineStage } from "../../lib/types";

export interface LeadTableProps { leads: Lead[]; showPipelineFilter?: boolean; }
type SortKey = "opportunityScore" | "name" | "category" | "location" | "websiteHealth" | "status" | "lastAnalyzedAt";

function SortIndicator({ keyName, sortKey, sortDir }: { keyName: SortKey; sortKey: SortKey; sortDir: "asc" | "desc" }) {
  return sortKey !== keyName ? <span className="text-subtle">↕</span> : <span className="text-accent">{sortDir === "desc" ? "↓" : "↑"}</span>;
}

export function LeadTable({ leads, showPipelineFilter = false }: LeadTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("opportunityScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeStage, setActiveStage] = useState<string>("all");

  const filteredLeads = useMemo(() => activeStage === "all" ? leads : leads.filter((l) => l.status === activeStage), [leads, activeStage]);
  const sortedLeads = useMemo(() => [...filteredLeads].sort((a, b) => {
    const va = sortKey === "opportunityScore" ? a.opportunityScore : sortKey === "name" ? a.business.name.toLowerCase() : sortKey === "category" ? a.business.category.toLowerCase() : sortKey === "location" ? a.business.location.city.toLowerCase() : sortKey === "websiteHealth" ? a.websiteHealth : sortKey === "status" ? a.status : a.lastAnalyzedAt ?? "";
    const vb = sortKey === "opportunityScore" ? b.opportunityScore : sortKey === "name" ? b.business.name.toLowerCase() : sortKey === "category" ? b.business.category.toLowerCase() : sortKey === "location" ? b.business.location.city.toLowerCase() : sortKey === "websiteHealth" ? b.websiteHealth : sortKey === "status" ? b.status : b.lastAnalyzedAt ?? "";
    return typeof va === "number" && typeof vb === "number" ? (sortDir === "asc" ? va - vb : vb - va) : sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  }), [filteredLeads, sortKey, sortDir]);

  const handleSort = (key: SortKey) => sortKey === key ? setSortDir(sortDir === "asc" ? "desc" : "asc") : (setSortKey(key), setSortDir(key === "opportunityScore" ? "desc" : "asc"));
  return (
    <div className="space-y-3">
      {showPipelineFilter && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveStage("all")} className={cn("px-3 py-1.5 rounded text-xs font-mono transition-all", activeStage === "all" ? "bg-accent/15 text-accent border border-accent/30" : "text-subtle hover:text-foreground hover:bg-surface-2 border border-border")}>All Leads</button>
          {(Object.keys(PIPELINE_STAGE_LABELS) as PipelineStage[]).map((stage) => <button key={stage} onClick={() => setActiveStage(stage)} className={cn("px-3 py-1.5 rounded text-xs font-mono capitalize transition-all", activeStage === stage ? "bg-accent/15 text-accent border border-accent/30" : "text-subtle hover:text-foreground hover:bg-surface-2 border border-border")}>{PIPELINE_STAGE_LABELS[stage]}</button>)}
        </div>
      )}

      <div className="hidden lg:block overflow-x-auto border border-border rounded-lg bg-surface/50">
        <table className="w-full text-sm font-mono">
          <thead className="bg-surface-2/50 border-b border-border"><tr>
            <th className="text-left px-3 py-2 text-xs font-medium text-subtle uppercase">Business</th>
            <th className="text-left px-3 py-2 cursor-pointer" onClick={() => handleSort("category")}><span className="font-medium text-xs text-subtle uppercase flex items-center gap-1">Category <SortIndicator keyName="category" sortKey={sortKey} sortDir={sortDir} /></span></th>
            <th className="text-left px-3 py-2 cursor-pointer" onClick={() => handleSort("location")}><span className="font-medium text-xs text-subtle uppercase flex items-center gap-1">Location <SortIndicator keyName="location" sortKey={sortKey} sortDir={sortDir} /></span></th>
            <th className="text-left px-3 py-2 text-xs font-medium text-subtle uppercase">Website</th>
            <th className="text-center px-3 py-2 cursor-pointer" onClick={() => handleSort("opportunityScore")}><span className="font-medium text-xs text-subtle uppercase flex items-center gap-1 justify-center">Opportunity <SortIndicator keyName="opportunityScore" sortKey={sortKey} sortDir={sortDir} /></span></th>
            <th className="text-center px-3 py-2 cursor-pointer" onClick={() => handleSort("websiteHealth")}><span className="font-medium text-xs text-subtle uppercase flex items-center gap-1 justify-center">Health <SortIndicator keyName="websiteHealth" sortKey={sortKey} sortDir={sortDir} /></span></th>
            <th className="text-center px-3 py-2 cursor-pointer" onClick={() => handleSort("status")}><span className="font-medium text-xs text-subtle uppercase flex items-center gap-1 justify-center">Status <SortIndicator keyName="status" sortKey={sortKey} sortDir={sortDir} /></span></th>
            <th className="text-center px-3 py-2 cursor-pointer" onClick={() => handleSort("lastAnalyzedAt")}><span className="font-medium text-xs text-subtle uppercase flex items-center gap-1 justify-center">Last Analyzed <SortIndicator keyName="lastAnalyzedAt" sortKey={sortKey} sortDir={sortDir} /></span></th>
            <th className="text-right px-3 py-2 text-xs font-medium text-subtle uppercase">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {sortedLeads.length === 0 ? <tr><td colSpan={9} className="p-4"><EmptyState title="No leads found" description="No leads match your current filter." /></td></tr> : sortedLeads.map((lead) => {
              const tier = getScoreTier(lead.opportunityScore); const meta = SCORE_TIER_META[tier]; const websiteDisplay = lead.business.website ? formatDomain(lead.business.website) : "—";
              return (<tr key={lead.id} className="border-b border-border/40 hover:bg-surface-2/30 group">
                <td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded flex-shrink-0 bg-surface-2 border border-border-strong/40 text-accent font-mono font-bold text-xs flex items-center justify-center">{initials(lead.business.name)}</div><Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:text-accent">{lead.business.name}</Link></div></td>
                <td className="px-3 py-2.5 text-subtle">{lead.business.category}</td>
                <td className="px-3 py-2.5 text-subtle">{lead.business.location.city}, {lead.business.location.country}</td>
                <td className="px-3 py-2.5">{lead.business.website ? <a href={lead.business.website} target="_blank" rel="noopener noreferrer" className="text-accent font-mono text-xs hover:underline">{websiteDisplay}</a> : <span className="text-xs text-subtle">No website</span>}</td>
                <td className="px-3 py-2.5 text-center"><OpportunityScore score={lead.opportunityScore} size="sm" /><div className="mt-0.5"><span className={cn("text-[9px] uppercase font-mono", meta.text)}>{tier}</span></div></td>
                <td className="px-3 py-2.5 text-center"><StatusBadge type="health" value={lead.websiteHealth} /></td>
                <td className="px-3 py-2.5 text-center"><StatusBadge type="stage" value={lead.status} /></td>
                <td className="px-3 py-2.5 text-center text-xs text-subtle font-mono">{formatDate(lead.lastAnalyzedAt)}</td>
                <td className="px-3 py-2.5 text-right"><Link href={`/leads/${lead.id}`} className="text-xs text-subtle hover:text-foreground underline">View</Link></td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden space-y-2">
        {sortedLeads.length === 0 ? <EmptyState title="No leads found" description="No leads match your current filter." /> : sortedLeads.map((lead) => (<Link key={lead.id} href={`/leads/${lead.id}`} className="block group"><div className="border border-border rounded-lg p-3 space-y-2 hover:border-accent/40"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded bg-surface-2 border border-border-strong/40 text-accent font-mono font-bold text-xs flex items-center justify-center">{initials(lead.business.name)}</div><span className="font-medium text-sm text-foreground group-hover:text-accent">{lead.business.name}</span></div><OpportunityScore score={lead.opportunityScore} size="sm" /></div><div className="grid grid-cols-2 gap-x-2 text-xs"><span className="text-subtle">{lead.business.category}</span><StatusBadge type="stage" value={lead.status} />{lead.business.website && <a href={lead.business.website} target="_blank" rel="noopener noreferrer" className="text-accent font-mono truncate hover:underline">{formatDomain(lead.business.website)}</a>}<StatusBadge type="health" value={lead.websiteHealth} /><span className="text-subtle font-mono">{formatDate(lead.lastAnalyzedAt)}</span><span className="text-subtle">{lead.business.location.city}, {lead.business.location.country}</span></div></div></Link>))}
      </div>
    </div>
  );
}