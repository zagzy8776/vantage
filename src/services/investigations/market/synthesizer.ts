import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { investigationMarketOpportunities, investigationMarketPatterns, investigationMarketSyntheses } from "@/lib/db/schema";
import { generateWithFallback } from "@/providers/ai/router";
import { createAction, getInvestigationDetail } from "@/services/investigations/service";
import { newId } from "@/lib/ids";
import { calculateMarketAggregates, buildMarketSynthesisInput } from "./aggregates";
import { buildMarketSynthesisPrompt, MARKET_SYNTHESIS_SYSTEM_PROMPT } from "./prompts";
import { parseMarketSynthesisJson, validateMarketSynthesis } from "./validator";
import type { MarketSynthesisSummary } from "./types";

export async function synthesizeMarket(investigationId: string): Promise<MarketSynthesisSummary> {
  const db = getDb();
  const running = await db.select({ id: investigationMarketSyntheses.id }).from(investigationMarketSyntheses).where(and(eq(investigationMarketSyntheses.investigationId, investigationId), eq(investigationMarketSyntheses.status, "running"))).limit(1);
  if (running[0]) throw new Error("A market synthesis is already running.");
  const detail = await getInvestigationDetail(investigationId, { includeEvidence: true });
  if (!detail) throw new Error("Investigation not found.");
  const aggregates = await calculateMarketAggregates(investigationId);
  if (!aggregates.sampleSize || !aggregates.evidence.total) throw new Error("No usable evidence is available for market synthesis.");
  const input = await buildMarketSynthesisInput(detail, aggregates);
  const synthesisId = newId();
  await db.insert(investigationMarketSyntheses).values({ id: synthesisId, investigationId, provider: "router", model: null, status: "running", validationStatus: "requires_review", aggregates: aggregates as unknown as Record<string, unknown>, createdAt: new Date() });
  try {
    const routerResult = await generateWithFallback({ messages: [{ role: "system", content: MARKET_SYNTHESIS_SYSTEM_PROMPT }, { role: "user", content: buildMarketSynthesisPrompt(input) }], temperature: 0, maxTokens: 1800, responseFormat: "json" });
    const parsed = parseMarketSynthesisJson(routerResult.content);
    const allowedNumbers = new Set<number>();
    const collect = (value: unknown) => { if (typeof value === "number") allowedNumbers.add(value); else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach(collect); };
    collect(aggregates);
    const validation = validateMarketSynthesis(parsed, { businessIds: new Set(input.businesses.map((business) => business.businessId)), evidenceIds: new Set(input.evidence.map((evidence) => evidence.id)), claimIds: new Set(input.claims.map((claim) => claim.id)), allowedNumbers });
    let patternsCreated = 0; let opportunitiesCreated = 0; let actionsCreated = 0;
    if (validation.status !== "rejected") {
      for (const pattern of validation.result.marketPatterns) {
        await db.insert(investigationMarketPatterns).values({ id: newId(), investigationId, synthesisId, title: pattern.title, summary: pattern.summary, patternType: pattern.type, confidence: pattern.confidence, affectedBusinessIds: pattern.businessIds, evidenceIds: pattern.evidenceIds, claimIds: pattern.claimIds, claimType: pattern.claimType, status: pattern.status, unknowns: pattern.unknowns, createdAt: new Date() });
        patternsCreated += 1;
      }
      for (const opportunity of validation.result.opportunities) {
        await db.insert(investigationMarketOpportunities).values({ id: newId(), investigationId, synthesisId, title: opportunity.title, statement: opportunity.statement, confidence: opportunity.confidence, affectedBusinessIds: opportunity.businessIds, evidenceIds: opportunity.evidenceIds, riskSummary: opportunity.riskSummary, status: opportunity.status, createdAt: new Date() });
        opportunitiesCreated += 1;
      }
      for (const action of validation.result.recommendedActions) {
        await createAction(investigationId, { title: action.title, description: action.description, priority: action.priority === "high" ? 3 : action.priority === "medium" ? 2 : 1, actionType: action.actionType, status: "todo" });
        actionsCreated += 1;
      }
    }
    await db.update(investigationMarketSyntheses).set({ provider: routerResult.metadata.provider, model: routerResult.metadata.model ?? null, status: validation.status === "supported" ? "completed" : "completed_with_errors", executiveSummary: validation.result.executiveSummary, risks: validation.result.risks, unknowns: validation.result.unknowns, actions: validation.result.recommendedActions, validationStatus: validation.status, validationIssues: validation.issues as unknown as Array<Record<string, unknown>> }).where(eq(investigationMarketSyntheses.id, synthesisId));
    return { synthesisId, status: validation.status === "supported" ? "completed" : "completed_with_errors", validationStatus: validation.status, provider: routerResult.metadata.provider, model: routerResult.metadata.model ?? null, patternsCreated, opportunitiesCreated, actionsCreated, issues: validation.issues };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market synthesis failed.";
    const failureDetails = typeof error === "object" && error !== null && "failureDetails" in error ? (error as { failureDetails?: unknown }).failureDetails : undefined;
    await db.update(investigationMarketSyntheses).set({ status: "failed", validationStatus: "rejected", validationIssues: [{ type: failureDetails ? "provider_attempts_failed" : "market_synthesis_failure", path: "provider", message, value: failureDetails }] }).where(eq(investigationMarketSyntheses.id, synthesisId));
    throw error;
  }
}

export async function getMarketHistory(investigationId: string) {
  const db = getDb();
  const syntheses = await db.select().from(investigationMarketSyntheses).where(eq(investigationMarketSyntheses.investigationId, investigationId)).orderBy(desc(investigationMarketSyntheses.createdAt)).limit(20);
  const patterns = await db.select().from(investigationMarketPatterns).where(eq(investigationMarketPatterns.investigationId, investigationId));
  const opportunities = await db.select().from(investigationMarketOpportunities).where(eq(investigationMarketOpportunities.investigationId, investigationId));
  return syntheses.map((synthesis) => ({ ...synthesis, patterns: patterns.filter((pattern) => pattern.synthesisId === synthesis.id), opportunities: opportunities.filter((opportunity) => opportunity.synthesisId === synthesis.id) }));
}