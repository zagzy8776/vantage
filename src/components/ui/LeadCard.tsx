import React from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { formatDomain, initials } from "../../lib/utils";
import { OpportunityScore } from "./OpportunityScore";
import { StatusBadge } from "./StatusBadge";
import type { Lead } from "../../lib/types";
import { Button } from "./Button";

export interface LeadCardProps {
  lead: Lead;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  onSelect?: (selected: boolean) => void;
  onAnalyzeWebsite?: () => void;
}

export function LeadCard({ lead, selected = false, onSelectedChange, onSelect, onAnalyzeWebsite }: LeadCardProps) {
  const handleSelectedChange = onSelectedChange ?? onSelect;
  const scoreTier = lead.opportunityScore >= 90 ? "Exceptional" : lead.opportunityScore >= 80 ? "High" : lead.opportunityScore >= 70 ? "Promising" : lead.opportunityScore >= 50 ? "Moderate" : "Low";
  const websiteDisplay = lead.business.website ? formatDomain(lead.business.website) : lead.websiteHealth === "none" ? "No website" : "Analyzing";
  return (
    <Link href={`/leads/${lead.id}`} className="group block">
      <div className={cn("bg-surface border border-border rounded-lg p-3 sm:p-4 flex gap-3 transition-all hover:border-accent/30 hover:shadow-md cursor-pointer")}>
        <div className="w-8 h-8 rounded flex-shrink-0 bg-surface-2 border border-border-strong/40 text-accent font-mono font-bold text-xs flex items-center justify-center">{initials(lead.business.name)}</div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2"><p className="font-semibold text-foreground text-sm group-hover:text-accent transition-colors truncate">{lead.business.name}</p><StatusBadge type="stage" value={lead.status} /></div>
          <p className="text-xs text-subtle truncate">{lead.business.category} • {lead.business.location.city}, {lead.business.location.country}</p>
          <p className="text-xs text-muted font-mono truncate">{websiteDisplay}</p>
          {lead.websiteAnalysis && <p className="text-[10px] text-subtle font-mono truncate">Website health: {lead.websiteAnalysis.technicalHealthScore ?? "—"} / 100</p>}
          {(handleSelectedChange || onAnalyzeWebsite) && <div className="flex items-center gap-2 pt-1 flex-wrap">
            {handleSelectedChange && <label className="inline-flex items-center gap-1 text-[10px] uppercase font-mono text-subtle cursor-pointer select-none"><input type="checkbox" checked={selected} onChange={(event) => handleSelectedChange(event.target.checked)} className="accent-accent" />Select</label>}
            {onAnalyzeWebsite && lead.business.website && <Button type="button" size="sm" variant="secondary" onClick={onAnalyzeWebsite} className="h-7 px-2 text-[10px]">Analyze</Button>}
          </div>}
          {lead.reason && <p className="text-[10px] text-subtle line-clamp-2 leading-tight">{lead.reason}</p>}
        </div>
        <div className="flex flex-col items-center justify-center gap-1 shrink-0"><OpportunityScore score={lead.opportunityScore} size="sm" /><span className="text-[9px] font-mono text-subtle uppercase">{scoreTier}</span></div>
      </div>
    </Link>
  );
}
