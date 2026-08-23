"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type {
  InvestigationFinding,
  InvestigationClaim,
  InvestigationBusinessSummary,
  InvestigationEvidenceItem,
  InvestigationAction,
} from "@/services/investigations/types";

export interface FindingDrawerProps {
  finding: InvestigationFinding | null;
  claims: InvestigationClaim[];
  businesses: InvestigationBusinessSummary[];
  evidence: InvestigationEvidenceItem[];
  actions: InvestigationAction[];
  onClose: () => void;
  onBusinessOpen?: (businessId: string) => void;
  onEvidenceOpen?: (evidenceId: string) => void;
}

const CLAIM_TYPE_STYLES: Record<string, string> = {
  fact: "bg-success/10 text-success border-success/30",
  derived: "bg-info/10 text-info border-info/30",
  inference: "bg-warning/10 text-warning border-warning/30",
  unknown: "bg-subtle/10 text-subtle border-subtle/40",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "text-success border-success/30 bg-success/10",
  medium: "text-warning border-warning/30 bg-warning/10",
  low: "text-subtle border-border bg-surface-2",
};

function toIso(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString();
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] uppercase font-mono text-subtle tracking-wider mb-2">{children}</h4>;
}

export function FindingDrawer({ finding, claims, businesses, evidence, actions, onClose, onBusinessOpen, onEvidenceOpen }: FindingDrawerProps) {
  if (!finding) return null;

  const affectedBusinesses = businesses.filter((b) => finding.businessIds.includes(b.businessId));
  const findingClaims = claims.filter((c) => finding.claimIds.includes(c.id));
  const findingEvidence = evidence.filter((e) => finding.evidenceIds.includes(e.id));
  const claimEvidence = evidence.filter((e) => findingClaims.some((c) => c.evidenceIds.includes(e.id)));
  const allEvidence = [...findingEvidence, ...claimEvidence.filter((ce) => !findingEvidence.some((fe) => fe.id === ce.id))];
  const relatedActions = actions.filter((a) =>
    a.description?.toLowerCase().includes(finding.title.toLowerCase()) || a.title.toLowerCase().includes(finding.title.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Finding details: ${finding.title}`}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 h-full w-full max-w-xl bg-surface border-l border-border overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border bg-accent/10 text-accent border-accent/30">{finding.findingType.replace(/_/g, " ")}</span>
              <span className={cn("text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border", finding.status === "supported" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30")}>{finding.status.replace(/_/g, " ")}</span>
              {typeof finding.confidence === "number" && <span className="text-[10px] font-mono text-subtle">{finding.confidence}% confidence</span>}
            </div>
            <h3 className="text-base font-semibold text-foreground leading-snug">{finding.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-subtle hover:text-foreground hover:bg-surface-2 shrink-0" aria-label="Close">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Summary */}
          <section>
            <SectionLabel>Finding</SectionLabel>
            <p className="text-sm text-muted leading-6">{finding.summary}</p>
          </section>

          {/* Affected Businesses */}
          <section>
            <SectionLabel>Affected Businesses ({affectedBusinesses.length})</SectionLabel>
            {affectedBusinesses.length === 0 ? (
              <p className="text-xs text-subtle">No linked businesses.</p>
            ) : (
              <div className="space-y-1.5">
                {affectedBusinesses.map((business) => (
                  <button type="button" key={business.businessId} id={`drawer-business-${business.businessId}`} onClick={() => onBusinessOpen?.(business.businessId)} className="w-full text-left border border-border rounded-md px-3 py-2 flex items-center justify-between gap-2 hover:border-accent/30 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm text-foreground font-medium truncate">{business.name}</div>
                      <div className="text-[10px] text-subtle truncate">{[business.category, business.city, business.country].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span className="text-[10px] font-mono uppercase text-subtle border border-border rounded px-1.5 py-0.5">{business.role}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Claims */}
          <section>
            <SectionLabel>Supporting Claims ({findingClaims.length})</SectionLabel>
            {findingClaims.length === 0 ? (
              <p className="text-xs text-subtle">No claims are linked to this finding yet.</p>
            ) : (
              <div className="space-y-2">
                {findingClaims.map((claim) => (
                  <div key={claim.id} id={`drawer-claim-${claim.id}`} className="border border-border rounded-md p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={cn("text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border", CLAIM_TYPE_STYLES[claim.claimType])}>{claim.claimType}</span>
                      <span className={cn("text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border", claim.status === "supported" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30")}>{claim.status.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-xs text-muted leading-5">{claim.statement}</p>
                    <div className="text-[10px] font-mono text-subtle mt-1.5">Evidence IDs: {claim.evidenceIds.length > 0 ? claim.evidenceIds.map((evidenceId) => <button type="button" key={evidenceId} onClick={() => onEvidenceOpen?.(evidenceId)} className="text-accent hover:underline mr-1">{evidenceId}</button>) : "none referenced"}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Evidence */}
          <section>
            <SectionLabel>Evidence ({allEvidence.length})</SectionLabel>
            {allEvidence.length === 0 ? (
              <p className="text-xs text-subtle">No evidence available.</p>
            ) : (
              <div className="space-y-2">
                {allEvidence.map((item) => (
                  <button type="button" key={item.id} id={`drawer-evidence-${item.id}`} onClick={() => onEvidenceOpen?.(item.id)} className="w-full text-left border border-border rounded-md p-3 hover:border-accent/40 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={cn("text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border", CONFIDENCE_STYLES[item.confidence] ?? CONFIDENCE_STYLES.low)}>{item.confidence}</span>
                      <span className="text-[10px] text-subtle font-mono uppercase">{item.sourceType}</span>
                      <span className="text-[10px] text-subtle font-mono">{item.category.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-subtle ml-auto">{formatDate(toIso(item.observedAt))}</span>
                    </div>
                    <p className="text-xs text-muted leading-5">{item.statement}</p>
                    {item.value && <p className="text-[11px] text-foreground font-mono mt-1 break-all">{item.value}</p>}
                    {item.sourceUrl ? (
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline break-all mt-1 inline-block">Original source →</a>
                    ) : (
                      <span className="text-[10px] text-subtle mt-1 inline-block">No source URL recorded</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Next Actions */}
          <section>
            <SectionLabel>Next Actions ({relatedActions.length})</SectionLabel>
            {relatedActions.length === 0 ? (
              <p className="text-xs text-subtle">No actions are associated with this finding.</p>
            ) : (
              <div className="space-y-1.5">
                {relatedActions.map((action) => (
                  <div key={action.id} className="border border-border rounded-md px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border bg-surface-2 text-subtle border-border">{action.actionType.replace(/_/g, " ")}</span>
                      <span className="text-xs text-foreground font-medium truncate">{action.title}</span>
                      <span className="ml-auto text-[10px] font-mono text-subtle">{action.status.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
