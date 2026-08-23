"use client";

import React from "react";
import type { InvestigationClaim } from "@/services/investigations/types";

export interface InvestigationUnknownsProps {
  claims: InvestigationClaim[];
  businessNameById: Map<string, string>;
  synthesisUnknowns?: string[];
}

export function InvestigationUnknowns({ claims, businessNameById, synthesisUnknowns = [] }: InvestigationUnknownsProps) {
  const unknownClaims = claims.filter((claim) => claim.claimType === "unknown");
  if (unknownClaims.length === 0 && synthesisUnknowns.length === 0) {
    return (
      <div className="space-y-3">
        <EmptyUnknowns />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-mono text-subtle">These are open questions. They are not negative facts about any business.</p>
      {synthesisUnknowns.length > 0 && (
        <div className="bg-surface border border-info/30 rounded-lg p-4">
          <div className="text-[10px] uppercase font-mono text-info tracking-wider mb-2">Latest synthesis knowledge gaps</div>
          <ul className="space-y-2 list-disc list-inside text-sm text-muted">
            {synthesisUnknowns.map((unknown, index) => <li key={`${unknown}-${index}`}>{unknown}</li>)}
          </ul>
        </div>
      )}
      {unknownClaims.map((claim) => (
        <div key={claim.id} className="bg-surface border border-info/30 rounded-lg p-4">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide bg-info/10 text-info border-info/30">unknown</span>
            {claim.businessId && <span className="text-[10px] font-mono text-subtle">{businessNameById.get(claim.businessId) ?? claim.businessId}</span>}
          </div>
          <p className="text-sm text-muted leading-6">{claim.statement}</p>
          <div className="text-[10px] font-mono text-subtle mt-1.5">Evidence referenced: {claim.evidenceIds.length > 0 ? claim.evidenceIds.join(", ") : "none — this is an open question"}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyUnknowns() {
  return (
    <div className="bg-surface border border-border rounded-lg p-6 text-center">
      <h3 className="text-sm font-semibold text-foreground">No recorded unknowns</h3>
      <p className="text-xs text-subtle mt-1.5 leading-5 max-w-md mx-auto">Unknowns are open questions, not failures. They appear when an analysis records what could not be verified, or when you record them as UNKNOWN claims.</p>
    </div>
  );
}
