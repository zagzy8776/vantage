"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import type { StoredLeadIntelligence } from "@/services/intelligence/types";

export interface LeadIntelligencePanelProps {
  leadId: string;
  initialScore: number;
  initialIntelligence: StoredLeadIntelligence | null;
  history: StoredLeadIntelligence[];
}

const levelLabels: Record<StoredLeadIntelligence["opportunityLevel"], string> = {
  "very-low": "VERY LOW",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  "very-high": "VERY HIGH",
};

const levelStyles: Record<StoredLeadIntelligence["opportunityLevel"], string> = {
  "very-low": "text-success border-success/40 bg-success/10",
  low: "text-success border-success/40 bg-success/10",
  medium: "text-warning border-warning/40 bg-warning/10",
  high: "text-accent border-accent/40 bg-accent/10",
  "very-high": "text-danger border-danger/40 bg-danger/10",
};

function List({ items, empty = "No supported items identified." }: { items: string[]; empty?: string }) {
  return items.length ? <ul className="space-y-2 text-sm text-subtle">{items.map((item) => <li key={item} className="flex gap-2"><span className="text-accent">•</span><span>{item}</span></li>)}</ul> : <p className="text-sm text-subtle">{empty}</p>;
}

function ClaimGroup({ title, type, items }: { title: string; type: StoredLeadIntelligence["evidence"][number]["type"]; items: StoredLeadIntelligence["evidence"] }) {
  const claims = items.filter((item) => item.type === type);
  return <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">{title}</div>{claims.length ? <div className="space-y-2">{claims.map((item, index) => <div key={`${item.source}-${index}`} className="border border-border rounded-md p-3"><p className="text-sm text-subtle">{item.statement}</p>{item.evidenceIds.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{item.evidenceIds.map((id) => <a key={id} href={`#evidence-${id}`} className="text-[10px] font-mono text-accent hover:underline">Evidence {id}</a>)}</div>}</div>)}</div> : <p className="text-sm text-subtle">None.</p>}</div>;
}

function validationMessage(selected: StoredLeadIntelligence) {
  if (selected.validationStatus === "supported") return "Findings are supported by the available research evidence.";
  if (selected.validationStatus === "rejected") return "This analysis needs more evidence before its findings can be trusted.";
  if (selected.validationStatus === "requires_review") return "Some findings need additional evidence review.";
  return "This is an earlier analysis and may need fresh validation.";
}

export function LeadIntelligencePanel({ leadId, initialScore, initialIntelligence, history }: LeadIntelligencePanelProps) {
  const [intelligence, setIntelligence] = useState(initialIntelligence);
  const [historyItems, setHistoryItems] = useState(history);
  const [selectedHistoryId, setSelectedHistoryId] = useState(initialIntelligence?.id ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => historyItems.find((item) => item.id === selectedHistoryId) ?? intelligence, [historyItems, intelligence, selectedHistoryId]);

  async function analyze() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/intelligence/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "AI analysis failed.");
      const next = payload.intelligence as StoredLeadIntelligence;
      setIntelligence(next);
      setHistoryItems((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      setSelectedHistoryId(next.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card title="VANTAGE Intelligence" subtitle="Evidence-grounded interpretation. The technical research stack stays behind the product.">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs text-subtle">Transparent reasoning with confidence and evidence links.</p>
        <Button size="sm" variant="secondary" isLoading={isLoading} onClick={analyze}>{intelligence ? "Re-analyze" : "Analyze"}</Button>
      </div>
      {!selected ? (
        <div className="space-y-2"><p className="text-sm text-subtle">No intelligence has been generated for this business yet.</p>{error && <p className="text-xs text-danger">{error}</p>}</div>
      ) : (
        <div className="space-y-6">
          <div className={`border rounded-md p-3 ${selected.validationStatus === "supported" ? "border-success/40 bg-success/5" : selected.validationStatus === "rejected" ? "border-danger/40 bg-danger/5" : "border-warning/40 bg-warning/5"}`}><div className="text-[10px] uppercase font-mono">Research confidence</div><p className="text-sm font-semibold mt-1">{validationMessage(selected)}</p><p className="mt-1 text-xs text-subtle">Confidence {selected.confidence}%</p></div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="border border-border rounded-lg p-3"><div className="text-[10px] text-subtle uppercase font-mono">Opportunity signal</div><div className="text-3xl font-mono font-extrabold mt-1">{selected.opportunityScore}<span className="text-sm text-subtle"> / 100</span></div></div>
            <div className={`border rounded-lg p-3 ${levelStyles[selected.opportunityLevel]}`}><div className="text-[10px] uppercase font-mono opacity-80">Priority</div><div className="text-xl font-mono font-extrabold mt-2">{levelLabels[selected.opportunityLevel]}</div></div>
            <div className="border border-border rounded-lg p-3"><div className="text-[10px] text-subtle uppercase font-mono">Initial signal</div><div className="text-3xl font-mono font-extrabold mt-1">{initialScore}<span className="text-sm text-subtle"> / 100</span></div></div>
          </div>

          <div><div className="text-[10px] text-subtle uppercase font-mono mb-1">Business summary</div><p className="text-sm leading-6">{selected.businessSummary}</p></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Strengths</div><List items={selected.strengths} /></div>
            <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Weaknesses</div><List items={selected.weaknesses} /></div>
            <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Supported opportunities</div><List items={selected.opportunities} /></div>
            <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Risks / uncertainty</div><List items={selected.risks} /></div>
          </div>

          <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Recommended next step</div><List items={selected.recommendedServices} empty="No specific action is supported by the available evidence yet." /></div>
          <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Still unknown</div><List items={selected.unknowns} empty="No explicit unknowns recorded." /></div>
          <div><div className="text-[10px] text-subtle uppercase font-mono mb-1">Why VANTAGE says this</div><p className="text-sm text-subtle leading-6">{selected.reasoning}</p></div>

          {selected.evidence.length > 0 && <div><div className="flex items-center justify-between gap-3 mb-3"><div className="text-[10px] text-subtle uppercase font-mono">Evidence behind the conclusion</div><div className="text-xs text-subtle">Confidence {selected.confidence}%</div></div><div className="space-y-4"><ClaimGroup title="Observed facts" type="fact" items={selected.evidence} /><ClaimGroup title="Derived observations" type="derived" items={selected.evidence} /><ClaimGroup title="Cautious inferences" type="inference" items={selected.evidence} /></div></div>}
          {selected.evidence.length === 0 && <div className="border border-border rounded-md p-3 text-sm text-subtle">No enrichment evidence was available for this analysis. The summary is based only on the business context and should be treated as preliminary.</div>}

          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-border pt-3"><div className="text-xs text-subtle">VANTAGE Intelligence</div><div className="text-xs text-subtle">{formatDate(selected.createdAt)} · confidence {selected.confidence}%</div></div>
          {historyItems.length > 1 && <label className="block text-xs text-subtle">Previous analyses<select className="mt-1 block w-full sm:w-auto bg-surface border border-border rounded px-2 py-1 text-xs text-foreground" value={selectedHistoryId} onChange={(event) => setSelectedHistoryId(event.target.value)}>{historyItems.map((item) => <option key={item.id} value={item.id}>{formatDate(item.createdAt)} · {item.opportunityScore}/100</option>)}</select></label>}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </Card>
  );
}