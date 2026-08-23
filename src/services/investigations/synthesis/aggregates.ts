import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  aiAnalyses,
  businesses,
  evidenceConflicts,
  evidenceItems,
  investigationBusinesses,
  investigationClaims,
  leads,
  websiteAnalyses,
} from "@/lib/db/schema";
import type { InvestigationDetail } from "@/services/investigations/types";
import type {
  InvestigationAggregates,
  InvestigationSynthesisInput,
  SynthesisBusinessSample,
  SynthesisClaim,
  SynthesisContradiction,
  SynthesisEvidence,
} from "./types";

const SIGNAL_CATEGORIES = ["booking", "ecommerce", "contact", "social_presence", "services", "pricing", "technology", "customer_signal"];
const MAX_SYNTHESIS_EVIDENCE = 24;

export function aggregateEvidenceRows(rows: Array<{ businessId: string; category: string; sourceType: string; confidence: string; observedAt: Date | string }>, now = Date.now()) {
  const bySource: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};
  const freshness = { last7Days: 0, last30Days: 0, older: 0 };
  const signalBusinesses = new Map<string, Set<string>>();
  const signalCounts = Object.fromEntries(SIGNAL_CATEGORIES.map((category) => [category, 0]));
  for (const item of rows) {
    bySource[item.sourceType] = (bySource[item.sourceType] ?? 0) + 1;
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
    byConfidence[item.confidence] = (byConfidence[item.confidence] ?? 0) + 1;
    const ageDays = (now - new Date(item.observedAt).getTime()) / 86_400_000;
    if (ageDays <= 7) freshness.last7Days += 1;
    else if (ageDays <= 30) freshness.last30Days += 1;
    else freshness.older += 1;
    if (SIGNAL_CATEGORIES.includes(item.category)) {
      signalCounts[item.category] = (signalCounts[item.category] ?? 0) + 1;
      const set = signalBusinesses.get(item.category) ?? new Set<string>();
      set.add(item.businessId);
      signalBusinesses.set(item.category, set);
    }
  }
  const signals = Object.fromEntries(SIGNAL_CATEGORIES.map((category) => [category, { evidenceCount: signalCounts[category] ?? 0, businessCount: signalBusinesses.get(category)?.size ?? 0 }]));
  return { bySource, byCategory, byConfidence, freshness, signals };
}

export function selectSynthesisEvidence<T extends { id: string; businessId: string; category: string; sourceType: string; observedAt: Date | string }>(rows: T[], referencedEvidenceIds: Set<string>, maxItems = MAX_SYNTHESIS_EVIDENCE): T[] {
  const sorted = [...rows].sort((left, right) => new Date(right.observedAt).getTime() - new Date(left.observedAt).getTime());
  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const add = (item: T) => {
    if (selected.length >= maxItems || selectedIds.has(item.id)) return;
    selected.push(item);
    selectedIds.add(item.id);
  };
  for (const item of sorted) if (referencedEvidenceIds.has(item.id)) add(item);
  for (const businessId of Array.from(new Set(sorted.map((item) => item.businessId)))) add(sorted.find((item) => item.businessId === businessId)!);
  for (const category of Array.from(new Set(sorted.map((item) => item.category)))) add(sorted.find((item) => item.category === category)!);
  for (const sourceType of Array.from(new Set(sorted.map((item) => item.sourceType)))) add(sorted.find((item) => item.sourceType === sourceType)!);
  for (const item of sorted) add(item);
  return selected;
}

export async function calculateInvestigationAggregates(investigationId: string): Promise<InvestigationAggregates> {
  const db = getDb();
  const relationships = await db.select({ businessId: investigationBusinesses.businessId }).from(investigationBusinesses).where(eq(investigationBusinesses.investigationId, investigationId));
  const businessIds = relationships.map((row) => row.businessId);

  const empty: InvestigationAggregates = {
    businesses: { total: 0, verified: 0, likely: 0, uncertain: 0, rejected: 0 },
    websites: { verified: 0, likely: 0, unknown: 0, pageSpeedAnalyses: 0, pageSpeedSuccessful: 0, pageSpeedFailed: 0 },
    evidence: { total: 0, bySource: {}, byCategory: {}, byConfidence: {}, freshness: { last7Days: 0, last30Days: 0, older: 0 } },
    ai: { total: 0, supported: 0, requiresReview: 0, rejected: 0, legacy: 0, failed: 0 },
    signals: {},
    claims: { total: 0, supported: 0, requiresReview: 0, unknown: 0, rejected: 0 },
    contradictions: { source: 0, ai: 0, total: 0 },
  };
  if (businessIds.length === 0) return empty;

  const businessRows = await db.select({ id: businesses.id, verificationStatus: businesses.verificationStatus, website: businesses.website }).from(businesses).where(inArray(businesses.id, businessIds));
  const websiteRows = await db.select({ status: websiteAnalyses.status }).from(websiteAnalyses).where(inArray(websiteAnalyses.businessId, businessIds));
  const leadRows = await db.select({ websiteStatus: leads.websiteStatus }).from(leads).where(inArray(leads.businessId, businessIds));
  const evidenceRows = await db.select({ id: evidenceItems.id, businessId: evidenceItems.businessId, category: evidenceItems.category, sourceType: evidenceItems.sourceType, confidence: evidenceItems.confidence, observedAt: evidenceItems.observedAt }).from(evidenceItems).where(inArray(evidenceItems.businessId, businessIds));
  const aiRows = await db.select({ status: aiAnalyses.status, validationStatus: aiAnalyses.validationStatus, validationIssues: aiAnalyses.validationIssues }).from(aiAnalyses).where(inArray(aiAnalyses.businessId, businessIds));
  const claims = await db.select({ status: investigationClaims.status, claimType: investigationClaims.claimType }).from(investigationClaims).where(eq(investigationClaims.investigationId, investigationId));
  const sourceConflictRows = await db.select({ id: evidenceConflicts.id }).from(evidenceConflicts).where(inArray(evidenceConflicts.businessId, businessIds));

  const verification = (status: string) => businessRows.filter((row) => row.verificationStatus === status).length;
  const evidenceAggregate = aggregateEvidenceRows(evidenceRows);

  const ai = { total: aiRows.length, supported: 0, requiresReview: 0, rejected: 0, legacy: 0, failed: aiRows.filter((row) => row.status === "failed").length };
  for (const row of aiRows) {
    if (row.validationStatus === "supported") ai.supported += 1;
    else if (row.validationStatus === "requires_review") ai.requiresReview += 1;
    else if (row.validationStatus === "rejected") ai.rejected += 1;
    else if (row.validationStatus === "legacy") ai.legacy += 1;
  }
  const pageSpeed = websiteRows.filter((row) => row.status === "success").length;
  const businessesWithKnownWebsite = leadRows.filter((row) => row.websiteStatus !== "none" && row.websiteStatus !== "unknown").length;
  const signals = evidenceAggregate.signals;
  const aiContradictions = aiRows.reduce((total, row) => total + (row.validationIssues ?? []).filter((issue) => issue.type === "contradiction").length, 0);
  return {
    businesses: { total: businessRows.length, verified: verification("verified"), likely: verification("likely"), uncertain: verification("uncertain"), rejected: verification("rejected") },
    websites: { verified: verification("verified"), likely: verification("likely"), unknown: Math.max(0, businessRows.length - businessesWithKnownWebsite), pageSpeedAnalyses: websiteRows.length, pageSpeedSuccessful: pageSpeed, pageSpeedFailed: websiteRows.filter((row) => row.status === "failed").length },
    evidence: { total: evidenceRows.length, bySource: evidenceAggregate.bySource, byCategory: evidenceAggregate.byCategory, byConfidence: evidenceAggregate.byConfidence, freshness: evidenceAggregate.freshness },
    ai,
    signals,
    claims: { total: claims.length, supported: claims.filter((row) => row.status === "supported").length, requiresReview: claims.filter((row) => row.status === "requires_review").length, unknown: claims.filter((row) => row.claimType === "unknown").length, rejected: claims.filter((row) => row.status === "rejected").length },
    contradictions: { source: sourceConflictRows.length, ai: aiContradictions, total: sourceConflictRows.length + aiContradictions },
  };
}

export async function buildInvestigationSynthesisInput(detail: InvestigationDetail, aggregates: InvestigationAggregates): Promise<InvestigationSynthesisInput> {
  const db = getDb();
  const businessIds = detail.businesses.map((business) => business.businessId);
  const claims = detail.claims.filter((claim) => claim.status === "supported" || claim.status === "requires_review");
  const referencedEvidenceIds = new Set(claims.flatMap((claim) => claim.evidenceIds));
  const evidenceRows = businessIds.length === 0 ? [] : await db.select({ id: evidenceItems.id, businessId: evidenceItems.businessId, statement: evidenceItems.statement, value: evidenceItems.value, category: evidenceItems.category, sourceType: evidenceItems.sourceType, sourceUrl: evidenceItems.sourceUrl, confidence: evidenceItems.confidence, observedAt: evidenceItems.observedAt }).from(evidenceItems).where(inArray(evidenceItems.businessId, businessIds)).limit(500);
  const selectedEvidenceRows = selectSynthesisEvidence(evidenceRows, referencedEvidenceIds);
  const businessById = new Map(detail.businessDetails.map((business) => [business.businessId, business]));
  const sample: SynthesisBusinessSample[] = detail.businesses.map((relationship) => {
    const business = businessById.get(relationship.businessId);
    return { businessId: relationship.businessId, name: business?.name ?? relationship.businessId, category: business?.category ?? null, city: business?.city ?? null, country: business?.country ?? null, verificationStatus: business?.verificationStatus ?? "unknown", website: business?.website ?? null };
  });
  const evidence: SynthesisEvidence[] = selectedEvidenceRows.map((item) => ({ ...item, observedAt: new Date(item.observedAt).toISOString() }));
  const claimInput: SynthesisClaim[] = claims.map((claim) => ({ id: claim.id, businessId: claim.businessId, claimType: claim.claimType, statement: claim.statement, confidence: claim.confidence, evidenceIds: claim.evidenceIds, status: claim.status === "supported" ? "supported" : "requires_review" }));
  const unknowns = detail.claims.filter((claim) => claim.claimType === "unknown").map((claim) => claim.statement);
  const contradictions: SynthesisContradiction[] = detail.sourceConflicts.map((conflict) => ({ id: conflict.id, category: "source", businessId: conflict.businessId, statement: conflict.items.map((item) => `${item.sourceType}: ${item.statement}`).join(" | "), sourceTypes: conflict.items.map((item) => item.sourceType), status: conflict.status }));
  return { investigation: { title: detail.title, objective: detail.objective, investigationType: detail.investigationType, industry: detail.industry, geography: { country: detail.country, region: detail.region, city: detail.city }, criteria: detail.criteria }, aggregates, businesses: sample, claims: claimInput, evidence, unknowns, contradictions };
}