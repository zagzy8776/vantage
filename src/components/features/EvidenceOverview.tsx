import type { EvidenceConflictRow, EvidenceItemRow } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";
import { evidenceFreshness } from "@/services/evidence/conflicts";
import type { ValidationIssue } from "@/services/intelligence/types";

export interface EvidenceOverviewProps {
  evidence: EvidenceItemRow[];
  conflicts?: EvidenceConflictRow[];
  verificationStatus?: string | null;
  aiConflicts?: ValidationIssue[];
}

const sections = [
  ["business_identity", "Business"],
  ["website", "Website"],
  ["services", "Services"],
  ["products", "Products"],
  ["booking", "Booking"],
  ["ecommerce", "E-commerce"],
  ["contact", "Contact"],
  ["social_presence", "Social Presence"],
  ["customer_signal", "Customer Signals"],
  ["technology", "Technical Signals"],
] as const;

const confidenceStyles: Record<string, string> = {
  high: "text-success border-success/30 bg-success/10",
  medium: "text-warning border-warning/30 bg-warning/10",
  low: "text-subtle border-border bg-surface-2",
};

export function EvidenceOverview({ evidence, verificationStatus, conflicts = [], aiConflicts = [] }: EvidenceOverviewProps) {
  const sourceLabels: Record<string, string> = { foursquare: "Foursquare", yelp: "Yelp", tavily: "Tavily", exa: "Exa", firecrawl: "Firecrawl", pagespeed: "PageSpeed", website: "Official website", public_page: "Public page", search_result: "Search result" };
  return (
    <div className="bg-surface border border-border rounded-lg shadow-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface-2/30">
        <div><h3 className="text-sm font-semibold">Evidence Overview</h3><p className="text-[10px] sm:text-xs text-subtle mt-0.5">Normalized public evidence. Raw page contents are not stored.</p></div>
        <span className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-border text-subtle">{verificationStatus ?? "uncertain"}</span>
      </div>
      <div className="p-4 sm:p-5 space-y-5">
        {conflicts.length > 0 && <section className="border border-warning/40 rounded-md p-3 bg-warning/5"><h4 className="text-[10px] text-warning uppercase font-mono mb-2">Conflicts requiring review</h4><div className="space-y-2">{conflicts.map((conflict) => <div key={conflict.id} className="text-sm text-subtle"><span className="font-mono text-warning">{conflict.category}/{conflict.fieldKey}</span><span className="ml-2">{conflict.items.map((item) => `${item.sourceType}: ${item.value ?? item.statement}`).join(" · ")}</span></div>)}</div></section>}
        {aiConflicts.length > 0 && <section className="border border-danger/40 rounded-md p-3 bg-danger/5"><h4 className="text-[10px] text-danger uppercase font-mono mb-2">AI evidence conflicts</h4><div className="space-y-2">{aiConflicts.map((conflict, index) => <div key={`${conflict.type}-${index}`} className="text-sm text-subtle"><span className="font-mono text-danger">{conflict.type}</span><span className="ml-2">{conflict.claim} — {conflict.reason}</span></div>)}</div></section>}
        {!evidence.length ? <p className="text-sm text-subtle">No enrichment evidence has been collected yet. Run a deep search with evidence enrichment enabled.</p> : sections.map(([category, label]) => {
          const items = evidence.filter((item) => item.category === category);
          if (!items.length) return null;
          return <section key={category}><h4 className="text-[10px] text-subtle uppercase font-mono mb-2">{label}</h4><div className="space-y-2">{items.map((item) => { const freshness = evidenceFreshness(item.observedAt.toISOString()); return <div id={`evidence-${item.id}`} key={item.id} className="border border-border rounded-md p-3"><div className="flex items-center gap-2 flex-wrap mb-1"><span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${confidenceStyles[item.confidence] ?? confidenceStyles.low}`}>{item.confidence}</span><span className="text-[10px] text-subtle font-mono">{sourceLabels[item.sourceType] ?? item.sourceType}</span><span className={`text-[10px] ${freshness === "fresh" ? "text-success" : freshness === "aging" ? "text-warning" : "text-danger"}`}>{freshness}</span><span className="text-[10px] text-subtle">{formatDate(item.observedAt.toISOString())}</span></div><p className="text-sm text-subtle leading-5">{item.statement}</p>{item.value && <p className="text-xs text-foreground font-mono mt-1 break-all">{item.value}</p>}{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline break-all mt-1 inline-block">{item.sourceUrl}</a>}</div>; })}</div></section>;
        })}
      </div>
    </div>
  );
}