import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { businesses, evidenceItems, investigationBusinesses, investigationFindings, leads, websiteAnalyses } from "@/lib/db/schema";
import type { InvestigationDetail } from "@/services/investigations/types";
import { selectSynthesisEvidence } from "@/services/investigations/synthesis/aggregates";
import type { MarketAggregates, MarketEvidence, MarketSynthesisInput } from "./types";
import { buildCandidateMarketPatterns } from "./patterns";

const SIGNALS = { websites: ["website"], booking: ["booking"], ecommerce: ["ecommerce"], contact: ["contact"], social: ["social_presence"], pricing: ["pricing"], services: ["services"] } as const;

export function countDistinctBusinessSignals(rows: Array<{ businessId: string; category: string }>) {
  const result: Record<string, number> = {};
  for (const category of Object.keys(SIGNALS)) result[category] = new Set(rows.filter((row) => (SIGNALS[category as keyof typeof SIGNALS] as readonly string[]).includes(row.category)).map((row) => row.businessId)).size;
  return result;
}

export async function calculateMarketAggregates(investigationId: string): Promise<MarketAggregates> {
  const db = getDb();
  const relations = await db.select({ businessId: investigationBusinesses.businessId }).from(investigationBusinesses).where(eq(investigationBusinesses.investigationId, investigationId));
  const businessIds = relations.map((row) => row.businessId);
  if (!businessIds.length) return { sampleSize: 0, businesses: { total: 0, verified: 0, likely: 0, uncertain: 0, rejected: 0 }, distinctBusinessSignals: { websites: 0, booking: 0, ecommerce: 0, contact: 0, social: 0, pricing: 0, services: 0, pageSpeedAvailable: 0, pageSpeedSuccessful: 0, aiSupportedFindings: 0, aiReviewFindings: 0 }, evidence: { total: 0, sourceDiversity: 0, bySource: {}, byCategory: {} }, sampleLanguage: "No businesses are attached to this investigation sample." };
  const businessRows = await db.select({ id: businesses.id, verificationStatus: businesses.verificationStatus }).from(businesses).where(inArray(businesses.id, businessIds));
  const evidenceRows = await db.select({ id: evidenceItems.id, businessId: evidenceItems.businessId, category: evidenceItems.category, sourceType: evidenceItems.sourceType, statement: evidenceItems.statement, value: evidenceItems.value, sourceUrl: evidenceItems.sourceUrl, confidence: evidenceItems.confidence, observedAt: evidenceItems.observedAt }).from(evidenceItems).where(inArray(evidenceItems.businessId, businessIds));
  const leadRows = await db.select({ businessId: leads.businessId, websiteStatus: leads.websiteStatus }).from(leads).where(inArray(leads.businessId, businessIds));
  const pageSpeedRows = await db.select({ businessId: websiteAnalyses.businessId, status: websiteAnalyses.status }).from(websiteAnalyses).where(inArray(websiteAnalyses.businessId, businessIds));
  const findingRows = await db.select({ status: investigationFindings.status }).from(investigationFindings).where(eq(investigationFindings.investigationId, investigationId));
  const bySource: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const signalBusinesses = new Map<string, Set<string>>();
  for (const row of evidenceRows) {
    bySource[row.sourceType] = (bySource[row.sourceType] ?? 0) + 1;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
    for (const [signal, categories] of Object.entries(SIGNALS)) if ((categories as readonly string[]).includes(row.category)) {
      const set = signalBusinesses.get(signal) ?? new Set<string>(); set.add(row.businessId); signalBusinesses.set(signal, set);
    }
  }
  const evidenceSignalCounts = countDistinctBusinessSignals(evidenceRows);
  const websiteBusinesses = new Set([...leadRows.filter((row) => row.websiteStatus !== "none" && row.websiteStatus !== "unknown").map((row) => row.businessId), ...evidenceRows.filter((row) => row.category === "website").map((row) => row.businessId)]);
  const pageSpeedAvailable = new Set(pageSpeedRows.map((row) => row.businessId));
  const pageSpeedSuccessful = new Set(pageSpeedRows.filter((row) => row.status === "success").map((row) => row.businessId));
  const distinctBusinessSignals = { websites: websiteBusinesses.size, booking: evidenceSignalCounts.booking ?? 0, ecommerce: evidenceSignalCounts.ecommerce ?? 0, contact: evidenceSignalCounts.contact ?? 0, social: evidenceSignalCounts.social ?? 0, pricing: evidenceSignalCounts.pricing ?? 0, services: evidenceSignalCounts.services ?? 0, pageSpeedAvailable: pageSpeedAvailable.size, pageSpeedSuccessful: pageSpeedSuccessful.size, aiSupportedFindings: findingRows.filter((row) => row.status === "supported").length, aiReviewFindings: findingRows.filter((row) => row.status === "requires_review").length };
  const businessesByStatus = (status: string) => businessRows.filter((row) => row.verificationStatus === status).length;
  return { sampleSize: businessRows.length, businesses: { total: businessRows.length, verified: businessesByStatus("verified"), likely: businessesByStatus("likely"), uncertain: businessesByStatus("uncertain"), rejected: businessesByStatus("rejected") }, distinctBusinessSignals, evidence: { total: evidenceRows.length, sourceDiversity: Object.keys(bySource).length, bySource, byCategory }, sampleLanguage: `This analysis describes the reviewed investigation sample of ${businessRows.length} businesses and should not be interpreted as a census of the entire market.` };
}

export async function buildMarketSynthesisInput(detail: InvestigationDetail, aggregates: MarketAggregates): Promise<MarketSynthesisInput> {
  const db = getDb();
  const businessIds = detail.businesses.map((row) => row.businessId);
  const rows = businessIds.length ? await db.select({ id: evidenceItems.id, businessId: evidenceItems.businessId, category: evidenceItems.category, sourceType: evidenceItems.sourceType, statement: evidenceItems.statement, value: evidenceItems.value, sourceUrl: evidenceItems.sourceUrl, confidence: evidenceItems.confidence, observedAt: evidenceItems.observedAt }).from(evidenceItems).where(inArray(evidenceItems.businessId, businessIds)).limit(500) : [];
  const candidates = buildCandidateMarketPatterns(rows, aggregates);
  const selected = selectSynthesisEvidence(rows, new Set(candidates.flatMap((pattern) => pattern.evidenceIds)), 24);
  const names = new Map(detail.businessDetails.map((business) => [business.businessId, business]));
  return { investigation: { title: detail.title, objective: detail.objective, industry: detail.industry, geography: { country: detail.country, region: detail.region, city: detail.city }, criteria: detail.criteria }, aggregates, candidatePatterns: candidates, businesses: detail.businesses.map((row) => { const business = names.get(row.businessId); return { businessId: row.businessId, name: business?.name ?? row.businessId, category: business?.category ?? null, city: business?.city ?? null, country: business?.country ?? null }; }), evidence: selected.map((row): MarketEvidence => ({ ...row, observedAt: new Date(row.observedAt).toISOString() })), claims: detail.claims.filter((claim) => claim.status !== "rejected").map((claim) => ({ id: claim.id, statement: claim.statement, evidenceIds: claim.evidenceIds, status: claim.status === "supported" ? "supported" : "requires_review" })), unknowns: detail.claims.filter((claim) => claim.claimType === "unknown").map((claim) => claim.statement), contradictions: detail.sourceConflicts.map((conflict) => ({ id: conflict.id, businessId: conflict.businessId, statement: conflict.items.map((item) => `${item.sourceType}: ${item.statement}`).join(" | "), status: conflict.status })) };
}