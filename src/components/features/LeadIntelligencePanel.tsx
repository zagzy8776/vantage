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
    <Card title="AI Intelligence" subtitle="Evidence-based interpretation. AI score remains separate from the initial score." headerAction={<Button size="sm" variant="secondary" isLoading={isLoading} onClick={analyze}>{intelligence ? "Re-analyze" : "Analyze with AI"}</Button>}>
      {!selected ? (
        <div className="space-y-2"><p className="text-sm text-subtle">No AI interpretation has been run for this lead.</p>{error && <p className="text-xs text-danger">{error}</p>}</div>
      ) : (
          <div className="space-y-6">
          <div className={`border rounded-md p-3 ${selected.validationStatus === "supported" ? "border-success/40 bg-success/5" : selected.validationStatus === "rejected" ? "border-danger/40 bg-danger/5" : "border-warning/40 bg-warning/5"}`}><div className="text-[10px] uppercase font-mono">AI validation</div><p className="text-sm font-semibold mt-1">{selected.validationStatus === "supported" ? "AI validation: Supported" : selected.validationStatus === "rejected" ? "AI output rejected" : "⚠ AI output requires evidence review"}</p>{selected.validationIssues.length > 0 && <ul className="mt-2 space-y-1 text-xs text-subtle">{selected.validationIssues.map((issue, index) => <li key={`${issue.type}-${index}`}>{issue.type}: {issue.reason}</li>)}</ul>}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="border border-border rounded-lg p-3"><div className="text-[10px] text-subtle uppercase font-mono">AI opportunity</div><div className="text-3xl font-mono font-extrabold mt-1">{selected.opportunityScore}<span className="text-sm text-subtle"> / 100</span></div></div>
            <div className={`border rounded-lg p-3 ${levelStyles[selected.opportunityLevel]}`}><div className="text-[10px] uppercase font-mono opacity-80">AI level</div><div className="text-xl font-mono font-extrabold mt-2">{levelLabels[selected.opportunityLevel]}</div></div>
            <div className="border border-border rounded-lg p-3"><div className="text-[10px] text-subtle uppercase font-mono">Initial score</div><div className="text-3xl font-mono font-extrabold mt-1">{initialScore}<span className="text-sm text-subtle"> / 100</span></div></div>
          </div>

          <div><div className="text-[10px] text-subtle uppercase font-mono mb-1">Business summary</div><p className="text-sm leading-6">{selected.businessSummary}</p></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Strengths</div><List items={selected.strengths} /></div>
            <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Weaknesses</div><List items={selected.weaknesses} /></div>
          <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Supported opportunities</div><List items={selected.opportunities} /></div>
            <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Risks / uncertainty</div><List items={selected.risks} /></div>
          </div>

          <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Recommended services</div><List items={selected.recommendedServices} empty="No specific service recommendation is supported by the available evidence." /></div>
          <div><div className="text-[10px] text-subtle uppercase font-mono mb-2">Unknowns</div><List items={selected.unknowns} empty="No explicit unknowns recorded." /></div>
          <div><div className="text-[10px] text-subtle uppercase font-mono mb-1">Reasoning</div><p className="text-sm text-subtle leading-6">{selected.reasoning}</p></div>

          <div><div className="flex items-center justify-between gap-3 mb-3"><div className="text-[10px] text-subtle uppercase font-mono">Evidence claims</div><div className="text-xs text-subtle">Confidence {selected.confidence}%</div></div><div className="space-y-4"><ClaimGroup title="Supported facts" type="fact" items={selected.evidence} /><ClaimGroup title="Derived observations" type="derived" items={selected.evidence} /><ClaimGroup title="Inferences" type="inference" items={selected.evidence} /></div></div>

          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-border pt-3"><div className="text-xs text-subtle">Analyzed by <span className="font-mono text-foreground">{selected.provider}</span>{selected.fallbackUsed && <span className="ml-2 text-warning">AI fallback used</span>}</div><div className="text-xs text-subtle">{formatDate(selected.createdAt)} · confidence {selected.confidence}%</div></div>
          {historyItems.length > 1 && <label className="block text-xs text-subtle">Historical analyses<select className="mt-1 block w-full sm:w-auto bg-surface border border-border rounded px-2 py-1 text-xs text-foreground" value={selectedHistoryId} onChange={(event) => setSelectedHistoryId(event.target.value)}>{historyItems.map((item) => <option key={item.id} value={item.id}>{formatDate(item.createdAt)} · {item.provider} · {item.opportunityScore}/100</option>)}</select></label>}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </Card>
  );
}