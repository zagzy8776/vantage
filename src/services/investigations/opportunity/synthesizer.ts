import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidenceItems, investigationActions, investigationFindings, investigationOpportunities, investigationOpportunitySyntheses } from "@/lib/db/schema";
import { generateWithFallback } from "@/providers/ai/router";
import { createAction, createFinding, createOpportunity, getInvestigationDetail } from "@/services/investigations/service";
import { classifyProblemSignals } from "./signals";
import { selectSynthesisEvidence } from "@/services/investigations/synthesis/aggregates";
import { buildOpportunityPrompt, OPPORTUNITY_SYNTHESIS_SYSTEM_PROMPT } from "./prompts";
import { validateOpportunitySynthesis } from "./validator";
import type { OpportunityInvestigationContext } from "./types";
import { newId } from "@/lib/ids";

export async function synthesizeOpportunityInvestigation(investigationId: string) {
  const db = getDb();
  const running = await db.select({ id: investigationOpportunitySyntheses.id }).from(investigationOpportunitySyntheses).where(and(eq(investigationOpportunitySyntheses.investigationId, investigationId), eq(investigationOpportunitySyntheses.status, "running"))).limit(1);
  if (running[0]) throw new Error("An opportunity synthesis is already running.");
  const detail = await getInvestigationDetail(investigationId, { includeEvidence: true });
  if (!detail) throw new Error("Investigation not found.");
  if (detail.investigationType !== "problem" && detail.investigationType !== "service_opportunity") throw new Error("Opportunity synthesis requires a problem or service opportunity investigation.");
  const businessIds = detail.businesses.map((row) => row.businessId);
  const allRows = businessIds.length ? await getDb().select({ id: evidenceItems.id, businessId: evidenceItems.businessId, statement: evidenceItems.statement, category: evidenceItems.category, sourceType: evidenceItems.sourceType, observedAt: evidenceItems.observedAt }).from(evidenceItems).where(inArray(evidenceItems.businessId, businessIds)).limit(500) : [];
  const category = typeof detail.criteria?.problemCategory === "string" ? detail.criteria.problemCategory as Parameters<typeof classifyProblemSignals>[0] : "workflow_fragmentation";
  const signals = classifyProblemSignals(category, allRows);
  const names = new Map(detail.businessDetails.map((business) => [business.businessId, business]));
  const context: OpportunityInvestigationContext = { input: { objective: detail.objective, problemCategory: category, serviceCategory: typeof detail.criteria?.serviceCategory === "string" ? detail.criteria.serviceCategory : undefined, industry: detail.industry ?? undefined, geography: { country: detail.country ?? undefined, region: detail.region ?? undefined, city: detail.city ?? undefined }, criteria: detail.criteria ?? undefined }, sampleSize: detail.businesses.length, businesses: detail.businesses.map((row) => ({ businessId: row.businessId, name: names.get(row.businessId)?.name ?? row.businessId, category: names.get(row.businessId)?.category ?? null })), signals, evidence: selectSynthesisEvidence(allRows, new Set(signals.flatMap((signal) => signal.evidenceIds)), 24), unknowns: detail.claims.filter((claim) => claim.claimType === "unknown").map((claim) => claim.statement), };
  if (!context.evidence.length) throw new Error("No usable evidence is available for opportunity investigation.");
  const synthesisId = newId();
  await db.insert(investigationOpportunitySyntheses).values({ id: synthesisId, investigationId, provider: "router", model: null, status: "running", objective: context.input as unknown as Record<string, unknown>, signals, validationStatus: "requires_review", createdAt: new Date() });
  let response;
  try {
    response = await generateWithFallback({ messages: [{ role: "system", content: OPPORTUNITY_SYNTHESIS_SYSTEM_PROMPT }, { role: "user", content: buildOpportunityPrompt(context) }], temperature: 0, maxTokens: 1800, responseFormat: "json" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Opportunity synthesis provider failure.";
    const failureDetails = typeof error === "object" && error !== null && "failureDetails" in error ? (error as { failureDetails?: unknown }).failureDetails : undefined;
    await db.update(investigationOpportunitySyntheses).set({ status: "failed", provider: "router", validationStatus: "rejected", signals, validationIssues: [{ type: failureDetails ? "provider_attempts_failed" : "provider_failure", path: "provider", message, value: failureDetails }] }).where(eq(investigationOpportunitySyntheses.id, synthesisId));
    throw error;
  }
  try {
    const parsed = JSON.parse(response.content) as unknown;
    const allowedNumbers = new Set<number>([context.sampleSize, ...context.signals.flatMap((signal) => [signal.businessIds.length, signal.evidenceIds.length])]);
    const validation = validateOpportunitySynthesis(parsed, { businessIds: new Set(context.businesses.map((business) => business.businessId)), evidenceIds: new Set(context.evidence.map((evidence) => evidence.id)), claimIds: new Set(detail.claims.map((claim) => claim.id)), allowedNumbers });
    let findingsCreated = 0; let opportunitiesCreated = 0; let actionsCreated = 0;
    if (validation.status !== "rejected") {
      for (const finding of validation.result.findings) { await createFinding(investigationId, { title: finding.title, summary: finding.summary, findingType: "operational_signal", confidence: finding.confidence, businessIds: finding.businessIds, evidenceIds: finding.evidenceIds, claimIds: finding.claimIds, status: validation.status === "supported" ? "supported" : "requires_review", unknowns: finding.unknowns }); findingsCreated += 1; }
      for (const opportunity of validation.result.opportunities) { await createOpportunity(investigationId, { title: opportunity.title, statement: opportunity.statement, confidence: opportunity.confidence, businessIds: opportunity.businessIds, evidenceIds: opportunity.evidenceIds, riskSummary: opportunity.riskSummary, status: opportunity.status, economicHypothesis: opportunity.economicHypothesis ?? null }); opportunitiesCreated += 1; }
      for (const action of validation.result.recommendedActions) { await createAction(investigationId, { title: action.title, description: action.description, priority: action.priority === "high" ? 3 : action.priority === "medium" ? 2 : 1, actionType: action.actionType, status: "todo" }); actionsCreated += 1; }
    }
    await db.update(investigationOpportunitySyntheses).set({ provider: response.metadata.provider, model: response.metadata.model ?? null, status: validation.status === "supported" ? "completed" : "completed_with_errors", findings: validation.result.findings, opportunities: validation.result.opportunities, unknowns: validation.result.unknowns, actions: validation.result.recommendedActions, signals, validationStatus: validation.status, validationIssues: validation.issues as unknown as Array<Record<string, unknown>> }).where(eq(investigationOpportunitySyntheses.id, synthesisId));
    return { synthesisId, status: validation.status, provider: response.metadata.provider, model: response.metadata.model ?? null, findingsCreated, opportunitiesCreated, actionsCreated, unknowns: validation.result.unknowns, signals, executiveSummary: validation.result.executiveSummary, issues: validation.issues };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Opportunity synthesis validation or persistence failed.";
    await db.update(investigationOpportunitySyntheses).set({ status: "failed", provider: response.metadata.provider, model: response.metadata.model ?? null, signals, validationStatus: "rejected", validationIssues: [{ type: message.includes("JSON") ? "malformed_json" : "validation_or_persistence_failure", path: "synthesis", message }] }).where(eq(investigationOpportunitySyntheses.id, synthesisId));
    throw error;
  }
}

/** Materialize a validated history result idempotently. Used after a provider response has been accepted. */
export async function materializeOpportunitySynthesis(synthesisId: string) {
  const db = getDb();
  const row = (await db.select().from(investigationOpportunitySyntheses).where(eq(investigationOpportunitySyntheses.id, synthesisId)).limit(1))[0];
  if (!row || row.validationStatus === "rejected") return { findings: 0, opportunities: 0, actions: 0 };
  const findings = Array.isArray(row.findings) ? row.findings : [];
  const opportunities = Array.isArray(row.opportunities) ? row.opportunities : [];
  const actions = Array.isArray(row.actions) ? row.actions : [];
  let findingCount = 0; let opportunityCount = 0; let actionCount = 0;
  for (let index = 0; index < findings.length; index += 1) {
    const item = findings[index] as Record<string, unknown>;
    const id = `opp_finding_${synthesisId}_${index}`;
    const exists = await db.select({ id: investigationFindings.id }).from(investigationFindings).where(eq(investigationFindings.id, id)).limit(1);
    if (!exists.length) {
      await db.insert(investigationFindings).values({ id, investigationId: row.investigationId, title: String(item.title ?? "Opportunity finding"), summary: String(item.summary ?? ""), findingType: "operational_signal", confidence: typeof item.confidence === "number" ? item.confidence : null, businessIds: Array.isArray(item.businessIds) ? item.businessIds as string[] : [], evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds as string[] : [], claimIds: Array.isArray(item.claimIds) ? item.claimIds as string[] : [], status: row.validationStatus === "supported" ? "supported" : "requires_review", unknowns: Array.isArray(item.unknowns) ? item.unknowns as string[] : [], createdAt: row.createdAt, updatedAt: row.createdAt });
      findingCount += 1;
    }
  }
  for (let index = 0; index < opportunities.length; index += 1) {
    const item = opportunities[index] as Record<string, unknown>;
    const id = `opp_hypothesis_${synthesisId}_${index}`;
    const exists = await db.select({ id: investigationOpportunities.id }).from(investigationOpportunities).where(eq(investigationOpportunities.id, id)).limit(1);
    if (!exists.length) {
      await db.insert(investigationOpportunities).values({ id, investigationId: row.investigationId, title: String(item.title ?? "Opportunity hypothesis"), statement: String(item.statement ?? ""), confidence: typeof item.confidence === "number" ? item.confidence : null, businessIds: Array.isArray(item.businessIds) ? item.businessIds as string[] : [], evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds as string[] : [], riskSummary: typeof item.riskSummary === "string" ? item.riskSummary : null, economicHypothesis: item.economicHypothesis && typeof item.economicHypothesis === "object" ? item.economicHypothesis as Record<string, unknown> : null, status: item.status === "needs_validation" ? "needs_validation" : "hypothesis", createdAt: row.createdAt, updatedAt: row.createdAt });
      opportunityCount += 1;
    }
  }
  for (let index = 0; index < actions.length; index += 1) {
    const item = actions[index] as Record<string, unknown>;
    const id = `opp_action_${synthesisId}_${index}`;
    const exists = await db.select({ id: investigationActions.id }).from(investigationActions).where(eq(investigationActions.id, id)).limit(1);
    if (!exists.length) {
      await db.insert(investigationActions).values({ id, investigationId: row.investigationId, title: String(item.title ?? "Validate opportunity"), description: typeof item.description === "string" ? item.description : null, priority: item.priority === "high" ? 3 : item.priority === "medium" ? 2 : 1, actionType: ["verify", "interview", "research", "compare", "collect_data", "manual_review"].includes(String(item.actionType)) ? item.actionType as "verify" | "interview" | "research" | "compare" | "collect_data" | "manual_review" : "manual_review", status: "todo", createdAt: row.createdAt, updatedAt: row.createdAt });
      actionCount += 1;
    }
  }
  return { findings: findingCount, opportunities: opportunityCount, actions: actionCount };
}