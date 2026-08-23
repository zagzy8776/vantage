import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiAnalyses, businesses, evidenceItems, leads, websiteAnalyses } from "@/lib/db/schema";
import { generateWithFallback } from "@/providers/ai/router";
import { buildLeadAnalysisUserPrompt, buildRepairPrompt, LEAD_ANALYSIS_SYSTEM_PROMPT } from "./prompts/lead-analysis";
import { parseLeadIntelligenceJson, type LeadIntelligence, type LeadIntelligenceInput, type StoredLeadIntelligence, type ValidationEvidence, type ValidationIssue, type AIValidationStatus } from "./types";
import { validateIntelligenceClaims } from "./claim-validator";

const DEFAULT_BATCH_LIMIT = 5;
const DEFAULT_CONCURRENCY = 2;

export function isLeadIdValid(leadId: string) {
  return /^[A-Za-z0-9_-]{1,160}$/.test(leadId);
}

async function loadLeadEvidence(leadId: string) {
  const db = getDb();
  const leadRows = await db
    .select({
      leadId: leads.id,
      businessId: businesses.id,
      name: businesses.name,
      category: businesses.category,
      address: businesses.address,
      country: businesses.country,
      region: businesses.region,
      city: businesses.city,
      area: businesses.area,
      phone: businesses.phone,
      website: businesses.website,
      rating: businesses.rating,
      reviewCount: businesses.reviewCount,
      source: businesses.source,
      websiteStatus: leads.websiteStatus,
    })
    .from(leads)
    .innerJoin(businesses, eq(leads.businessId, businesses.id))
    .where(eq(leads.id, leadId))
    .limit(1);

  const lead = leadRows[0];
  if (!lead) return null;

  const websiteRows = await db
    .select({
      url: websiteAnalyses.url,
      strategy: websiteAnalyses.strategy,
      performanceScore: websiteAnalyses.performanceScore,
      accessibilityScore: websiteAnalyses.accessibilityScore,
      bestPracticesScore: websiteAnalyses.bestPracticesScore,
      seoScore: websiteAnalyses.seoScore,
      status: websiteAnalyses.status,
      analyzedAt: websiteAnalyses.analyzedAt,
    })
    .from(websiteAnalyses)
    .where(eq(websiteAnalyses.businessId, lead.businessId))
    .orderBy(desc(websiteAnalyses.analyzedAt))
    .limit(10);

  const mobile = websiteRows.find((row) => row.strategy === "mobile");
  const desktop = websiteRows.find((row) => row.strategy === "desktop");
  const latest = websiteRows[0];
  const website = lead.website || latest?.url;
  const evidenceRows = await db.select({ id: evidenceItems.id, category: evidenceItems.category, statement: evidenceItems.statement, value: evidenceItems.value, sourceType: evidenceItems.sourceType, sourceUrl: evidenceItems.sourceUrl, confidence: evidenceItems.confidence, observedAt: evidenceItems.observedAt }).from(evidenceItems).where(eq(evidenceItems.businessId, lead.businessId)).orderBy(desc(evidenceItems.observedAt)).limit(100);

  const input: LeadIntelligenceInput = {
    business: {
      name: lead.name,
      category: lead.category || undefined,
      location: [lead.address, lead.area, lead.city, lead.region, lead.country].filter(Boolean).join(", ") || undefined,
      rating: lead.rating !== null ? Number(lead.rating) : undefined,
      reviewCount: lead.reviewCount ?? undefined,
      website: website || undefined,
      phone: lead.phone || undefined,
      source: lead.source || undefined,
    },
  };

  if (websiteRows.length > 0 || website) {
    input.website = {
      url: website || "",
      status: lead.websiteStatus,
      performance: latest?.performanceScore ?? undefined,
      accessibility: latest?.accessibilityScore ?? undefined,
      bestPractices: latest?.bestPracticesScore ?? undefined,
      seo: latest?.seoScore ?? undefined,
      mobilePerformance: mobile?.performanceScore ?? undefined,
      desktopPerformance: desktop?.performanceScore ?? undefined,
      analyzedAt: latest?.analyzedAt?.toISOString(),
    };
  }
  if (evidenceRows.length) {
    input.evidence = evidenceRows.map((row) => ({ id: row.id, category: row.category, statement: row.statement, value: row.value ?? undefined, sourceType: row.sourceType, sourceUrl: row.sourceUrl ?? undefined, confidence: row.confidence, observedAt: row.observedAt.toISOString() }));
  }

  return { lead, input };
}

function rowToStored(row: typeof aiAnalyses.$inferSelect): StoredLeadIntelligence | null {
  if (!row.businessSummary || !row.opportunityLevel || row.opportunityScore === null || !row.reasoning || row.confidence === null) return null;
  try {
    const intelligence = parseLeadIntelligenceJson(JSON.stringify({
      businessSummary: row.businessSummary,
      opportunityLevel: row.opportunityLevel,
      opportunityScore: row.opportunityScore,
      strengths: row.strengths ?? [],
      weaknesses: row.weaknesses ?? [],
      opportunities: row.opportunities ?? [],
      risks: row.risks ?? [],
      recommendedServices: row.recommendedServices ?? [],
      evidence: (row.evidence ?? []).map((item) => ({ ...item, evidenceIds: item.evidenceIds ?? [] })),
      unknowns: row.unknowns ?? [],
      reasoning: row.reasoning,
      confidence: row.confidence,
    }));
    return {
      ...intelligence,
      id: row.id,
      leadId: row.leadId,
      businessId: row.businessId,
      provider: row.provider,
      model: row.model,
      fallbackUsed: Boolean(row.fallbackUsed),
      attempts: row.attempts,
      validationStatus: (row.validationStatus ?? "legacy") as AIValidationStatus,
      validationIssues: (row.validationIssues ?? []) as ValidationIssue[],
      usage: row.totalTokens !== null ? { promptTokens: row.promptTokens ?? undefined, completionTokens: row.completionTokens ?? undefined, totalTokens: row.totalTokens } : undefined,
      createdAt: row.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getLatestLeadIntelligence(leadId: string): Promise<StoredLeadIntelligence | null> {
  const db = getDb();
  const rows = await db.select().from(aiAnalyses).where(eq(aiAnalyses.leadId, leadId)).orderBy(desc(aiAnalyses.createdAt)).limit(10);
  return rows.map(rowToStored).find((row): row is StoredLeadIntelligence => Boolean(row)) ?? null;
}

export async function getLeadIntelligenceHistory(leadId: string): Promise<StoredLeadIntelligence[]> {
  const db = getDb();
  const rows = await db.select().from(aiAnalyses).where(eq(aiAnalyses.leadId, leadId)).orderBy(desc(aiAnalyses.createdAt)).limit(20);
  return rows.map(rowToStored).filter((row): row is StoredLeadIntelligence => Boolean(row));
}

async function persistIntelligence(leadId: string, businessId: string, intelligence: LeadIntelligence, metadata: { provider: string; model?: string | null; fallbackUsed: boolean; attempts: number; failures?: Array<{ provider: string; status?: number; message: string }> }, validation: { status: Exclude<AIValidationStatus, "legacy">; issues: ValidationIssue[] }, usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }, runId?: string) {
  const db = getDb();
  const now = new Date();
  const id = `ai_${leadId}_${Date.now()}`;
  await db.insert(aiAnalyses).values({
    id,
    leadId,
    businessId,
    runId: runId ?? null,
    provider: metadata.provider,
    model: metadata.model ?? null,
    status: "success",
    opportunityScore: intelligence.opportunityScore,
    opportunityLevel: intelligence.opportunityLevel,
    businessSummary: intelligence.businessSummary,
    strengths: intelligence.strengths,
    weaknesses: intelligence.weaknesses,
    opportunities: intelligence.opportunities,
    risks: intelligence.risks,
    recommendedServices: intelligence.recommendedServices,
    evidence: intelligence.evidence,
    unknowns: intelligence.unknowns,
    reasoning: metadata.failures?.length ? `${intelligence.reasoning}\n\nProvider attempts: ${JSON.stringify(metadata.failures)}` : intelligence.reasoning,
    confidence: intelligence.confidence,
    validationStatus: validation.status,
    validationIssues: validation.issues,
    fallbackUsed: metadata.fallbackUsed ? 1 : 0,
    attempts: metadata.attempts,
    promptTokens: usage?.promptTokens ?? null,
    completionTokens: usage?.completionTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
    createdAt: now,
  });
  if (validation.status === "supported") {
    await db.update(leads).set({ aiOpportunityScore: intelligence.opportunityScore, aiOpportunityLevel: intelligence.opportunityLevel, aiAnalyzedAt: now, updatedAt: now }).where(eq(leads.id, leadId));
  }

  return { ...intelligence, id, leadId, businessId, provider: metadata.provider, model: metadata.model ?? null, fallbackUsed: metadata.fallbackUsed, attempts: metadata.attempts, validationStatus: validation.status, validationIssues: validation.issues, usage, createdAt: now.toISOString() } satisfies StoredLeadIntelligence;
}

async function persistFailedAnalysis(leadId: string, businessId: string, errorCode: string, runId?: string) {
  const db = getDb();
  await db.insert(aiAnalyses).values({
    id: `ai_failed_${leadId}_${Date.now()}`,
    leadId,
    businessId,
    runId: runId ?? null,
    provider: "router",
    model: null,
    status: "failed",
    errorCode,
    createdAt: new Date(),
  });
}

export async function analyzeLead(leadId: string, options?: { runId?: string }): Promise<StoredLeadIntelligence> {
  if (!isLeadIdValid(leadId)) throw new Error("Invalid lead ID.");
  const evidence = await loadLeadEvidence(leadId);
  if (!evidence) throw new Error("Lead not found.");
  const hasBusinessSignals = Boolean(evidence.input.business.name || evidence.input.business.location || evidence.input.business.phone || evidence.input.business.rating !== undefined || evidence.input.business.reviewCount !== undefined);
  if (!evidence.input.evidence?.length && !evidence.input.website && !hasBusinessSignals) {
    await persistFailedAnalysis(evidence.lead.leadId, evidence.lead.businessId, "insufficient-evidence", options?.runId);
    throw new Error("Meaningful evidence is required before AI analysis.");
  }

  const request = {
    messages: [
      { role: "system" as const, content: LEAD_ANALYSIS_SYSTEM_PROMPT },
      { role: "user" as const, content: buildLeadAnalysisUserPrompt(evidence.input) },
    ],
    temperature: 0,
    maxTokens: 1800,
    responseFormat: "json" as const,
  };
  let routerResult;
  try {
    routerResult = await generateWithFallback(request, {
      validate: (content) => { parseLeadIntelligenceJson(content); },
      repairRequest: (content) => ({ ...request, messages: [{ role: "system" as const, content: LEAD_ANALYSIS_SYSTEM_PROMPT }, { role: "user" as const, content: buildRepairPrompt(content) }] }),
    });
  } catch (error) {
    const failureDetails = typeof error === "object" && error !== null && "failureDetails" in error ? (error as { failureDetails?: Array<{ provider: string; status?: number; message: string }> }).failureDetails : undefined;
    const errorCode = error instanceof Error && error.message.includes("No AI provider") ? "provider-not-configured" : "provider-unavailable";
    const diagnostic = failureDetails?.length ? `${errorCode}:${JSON.stringify(failureDetails).slice(0, 1000)}` : errorCode;
    await persistFailedAnalysis(evidence.lead.leadId, evidence.lead.businessId, diagnostic, options?.runId);
    throw error;
  }
  const intelligence = parseLeadIntelligenceJson(routerResult.content);
  const validationEvidence: ValidationEvidence[] = (evidence.input.evidence ?? []).map((item) => ({ id: item.id, businessId: evidence.lead.businessId, statement: item.statement, value: item.value, sourceType: item.sourceType, sourceUrl: item.sourceUrl }));
  const validation = validateIntelligenceClaims(intelligence, validationEvidence, evidence.lead.businessId);
  return persistIntelligence(evidence.lead.leadId, evidence.lead.businessId, intelligence, routerResult.metadata, validation, routerResult.usage, options?.runId);
}

export async function analyzeLeads(leadIds: string[], options?: { limit?: number; maxConcurrency?: number }) {
  const limit = options?.limit ?? DEFAULT_BATCH_LIMIT;
  if (leadIds.length > limit) throw new Error(`Batch intelligence analysis is limited to ${limit} leads.`);
  const queue = Array.from(new Set(leadIds));
  const results: Array<StoredLeadIntelligence | { leadId: string; error: string }> = [];
  const concurrency = Math.max(1, Math.min(options?.maxConcurrency ?? DEFAULT_CONCURRENCY, limit));

  async function worker() {
    while (queue.length) {
      const leadId = queue.shift();
      if (!leadId) return;
      try { results.push(await analyzeLead(leadId)); } catch (error) { results.push({ leadId, error: error instanceof Error ? error.message : "Analysis failed." }); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));
  return { total: results.length, successCount: results.filter((result): result is StoredLeadIntelligence => "opportunityScore" in result).length, failureCount: results.filter((result) => "error" in result).length, results };
}