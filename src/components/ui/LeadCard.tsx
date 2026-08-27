"use client";

import Link from "next/link";
import { cn, formatDomain } from "../../lib/utils";
import type { Lead } from "../../lib/types";
import { StatusBadge } from "./StatusBadge";
import { OpportunityScore } from "./OpportunityScore";
import { Button } from "./Button";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export interface LeadCardProps {
  lead: Lead;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onAnalyzeWebsite?: () => void;
}

export function LeadCard({ lead, selected = false, onSelect, onAnalyzeWebsite }: LeadCardProps) {
  const handleSelectedChange = onSelect;
  const scoreTier =
    lead.opportunityScore >= 90
      ? "Exceptional"
      : lead.opportunityScore >= 80
        ? "High"
        : lead.opportunityScore >= 70
          ? "Promising"
          : lead.opportunityScore >= 50
            ? "Moderate"
            : "Low";
  const websiteDisplay = lead.business.website
    ? formatDomain(lead.business.website)
    : lead.websiteHealth === "none"
      ? "No website"
      : "Analyzing";

  return (
    <Link href={`/leads/${lead.id}`} className="group block">
      <div
        className={cn(
          "bg-surface/90 border border-border rounded-xl p-3.5 sm:p-4 flex gap-3 transition-all",
          "hover:border-accent/35 hover:bg-surface hover:shadow-card"
        )}
      >
        <div className="w-9 h-9 rounded-lg flex-shrink-0 bg-surface-2 border border-border text-accent font-mono font-bold text-xs flex items-center justify-center">
          {initials(lead.business.name)}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-foreground text-sm group-hover:text-accent transition-colors truncate">
              {lead.business.name}
            </p>
            <StatusBadge type="stage" value={lead.status} />
          </div>
          <p className="text-xs text-subtle truncate">
            {lead.business.category} · {lead.business.location.city}, {lead.business.location.country}
          </p>
          <p className="text-xs text-muted truncate">{websiteDisplay}</p>
          {lead.reason && (
            <p className="text-[11px] text-subtle line-clamp-2 leading-snug">{lead.reason}</p>
          )}
          {(handleSelectedChange || onAnalyzeWebsite) && (
            <div className="flex items-center gap-2 pt-1 flex-wrap" onClick={(e) => e.preventDefault()}>
              {handleSelectedChange && (
                <label className="inline-flex items-center gap-1.5 text-[10px] uppercase font-mono text-subtle cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => handleSelectedChange(event.target.checked)}
                    className="accent-accent"
                  />
                  Select
                </label>
              )}
              {onAnalyzeWebsite && lead.business.website && (
                <Button type="button" size="sm" variant="secondary" onClick={onAnalyzeWebsite} className="h-7 px-2 text-[10px]">
                  Analyze
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center justify-center gap-1 shrink-0">
          <OpportunityScore score={lead.opportunityScore} size="sm" />
          <span className="text-[9px] font-mono text-subtle uppercase">{scoreTier}</span>
        </div>
      </div>
    </Link>
  );
}
