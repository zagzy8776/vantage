"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { InvestigationSourceConflict, InvestigationAiConflict } from "@/services/investigations/types";

export interface InvestigationContradictionsProps {
  sourceConflicts: InvestigationSourceConflict[];
  aiConflicts: InvestigationAiConflict[];
  businessNameById: Map<string, string>;
}

export function InvestigationContradictions({ sourceConflicts, aiConflicts, businessNameById }: InvestigationContradictionsProps) {
  return (
    <div className="space-y-5">
      <section>
        <h4 className="text-[10px] uppercase font-mono text-subtle tracking-wider mb-2">Source conflicts ({sourceConflicts.length})</h4>
        {sourceConflicts.length === 0 ? (
          <p className="text-xs text-subtle bg-surface border border-border rounded-lg px-4 py-3">No source conflicts detected. Conflicts appear when two sources report competing values for the same field.</p>
        ) : (
          <div className="space-y-2">
            {sourceConflicts.map((conflict) => (
              <div key={conflict.id} className="bg-surface border border-warning/40 rounded-lg p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide bg-warning/10 text-warning border-warning/30">{conflict.category.replace(/_/g, " ")}/{conflict.fieldKey.replace(/_/g, " ")}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide bg-surface-2 text-subtle border-border">{conflict.status}</span>
                  <span className="text-[10px] font-mono text-subtle ml-auto">{businessNameById.get(conflict.businessId) ?? conflict.businessId}</span>
                </div>
                <div className="space-y-1.5">
                  {conflict.items.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      <span className="font-mono text-warning shrink-0 w-24 truncate" title={item.sourceType}>{item.sourceType}</span>
                      <span className="text-muted">{item.value ?? item.statement}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h4 className="text-[10px] uppercase font-mono text-subtle tracking-wider mb-2">AI evidence conflicts ({aiConflicts.length})</h4>
        {aiConflicts.length === 0 ? (
          <p className={cn("text-xs text-subtle bg-surface border border-border rounded-lg px-4 py-3")}>No AI evidence conflicts detected. These appear when an AI claim contradicts persisted evidence.</p>
        ) : (
          <div className="space-y-2">
            {aiConflicts.map((conflict, index) => (
              <div key={`${conflict.analysisId}-${index}`} className="bg-surface border border-danger/40 rounded-lg p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide bg-danger/10 text-danger border-danger/30">{conflict.type.replace(/_/g, " ")}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide bg-surface-2 text-subtle border-border">analysis {conflict.validationStatus}</span>
                  <span className="text-[10px] font-mono text-subtle ml-auto">{businessNameById.get(conflict.businessId) ?? conflict.businessId}</span>
                </div>
                <p className="text-xs text-muted leading-5"><span className="text-danger font-medium">AI claim:</span> {conflict.claim}</p>
                <p className="text-xs text-subtle leading-5 mt-1"><span className="text-warning font-medium">Conflict:</span> {conflict.reason}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
