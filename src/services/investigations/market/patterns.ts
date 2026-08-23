import type { MarketAggregates, CandidateMarketPattern } from "./types";

export function buildCandidateMarketPatterns(rows: Array<{ id: string; businessId: string; category: string; sourceType: string }>, aggregates: MarketAggregates): CandidateMarketPattern[] {
  const patterns: CandidateMarketPattern[] = [];
  const sample = aggregates.sampleSize;
  const add = (key: string, title: string, summary: string, type: CandidateMarketPattern["patternType"], category: string, confidence: number) => {
    const relevant = rows.filter((row) => row.category === category);
    const businesses = Array.from(new Set(relevant.map((row) => row.businessId)));
    if (!businesses.length) return;
    patterns.push({ id: key, title, summary, patternType: type, claimType: "derived", affectedBusinessIds: businesses, evidenceIds: relevant.map((row) => row.id), confidence, status: "candidate" });
  };
  add("booking-presence", "Booking evidence in the reviewed sample", `Booking evidence was observed for ${aggregates.distinctBusinessSignals.booking} of the ${sample} reviewed businesses. Booking status for the remaining businesses is not established by the supplied evidence.`, "operational_signal", "booking", 70);
  add("ecommerce-presence", "E-commerce evidence in the reviewed sample", `E-commerce evidence was observed for ${aggregates.distinctBusinessSignals.ecommerce} of the ${sample} reviewed businesses.`, "digital_pattern", "ecommerce", 70);
  add("contact-presence", "Contact evidence across reviewed businesses", `Contact evidence was observed for ${aggregates.distinctBusinessSignals.contact} of the ${sample} reviewed businesses.`, "service_signal", "contact", 65);
  add("services-presence", "Service information evidence", `Service evidence was observed for ${aggregates.distinctBusinessSignals.services} of the ${sample} reviewed businesses.`, "service_signal", "services", 65);
  if (!patterns.length) patterns.push({ id: "evidence-gap", title: "Limited cross-business signal coverage", summary: `The reviewed sample of ${sample} businesses has limited evidence for cross-business pattern interpretation. This is an evidence gap, not proof that the underlying capabilities are absent.`, patternType: "evidence_gap", claimType: "unknown", affectedBusinessIds: [], evidenceIds: [], confidence: 30, status: "candidate" });
  return patterns;
}