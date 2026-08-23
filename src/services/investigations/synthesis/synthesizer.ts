import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { investigationSyntheses } from "@/lib/db/schema";
import { generateWithFallback } from "@/providers/ai/router";
import { buildInvestigationSynthesisUserPrompt, INVESTIGATION_SYNTHESIS_SYSTEM_PROMPT } from "./prompts";
import { parseInvestigationSynthesisJson, validateInvestigationSynthesis } from "./validator";
import type { InvestigationSynthesisHistory } from "@/services/investigations/types";
import type { InvestigationAggregates, InvestigationSynthesisInput, SynthesisRunSummary, SynthesisValidationIssue } from "./types";
import { newId } from "@/lib/ids";
import { createAction, createFinding, createOpportunity, getInvestigationDetail } from "@/services/investigations/service";
import { calculateInvestigationAggregates, buildInvestigationSynthesisInput } from "./aggregates";

function mapHistory(row: typeof investigationSyntheses.$inferSelect): InvestigationSynthesisHistory {
  return {
    id: row.id,
    investigationId: row.investigationId,
    provider: row.provider,
    model: row.model,
    status: row.status as InvestigationSynthesisHistory["status"],
    executiveSummary: row.executiveSummary,
    aggregates: row.aggregates ?? null,
    findings: row.findings ?? [],
    opportunities: row.opportunities ?? [],
    risks: row.risks ?? [],
    unknowns: row.unknowns ?? [],
    actions: row.actions ?? [],
    validationStatus: row.validationStatus as InvestigationSynthesisHistory["validationStatus"],
    validationIssues: row.validationIssues ?? [],
    createdAt: row.createdAt,
  };
}

export async function getInvestigationSynthesisHistory(investigationId: string): Promise<InvestigationSynthesisHistory[]> {
  const rows = await getDb().select().from(investigationSyntheses).where(eq(investigationSyntheses.investigationId, investigationId)).orderBy(desc(investigationSyntheses.createdAt)).limit(20);
  return rows.map(mapHistory);
}

async function createHistory(investigationId: string, provider: string, model: string | null, status: InvestigationSynthesisHistory["status"], fields: Partial<typeof investigationSyntheses.$inferInsert> = {}) {
  const row = {
    id: newId(),
    investigationId,
    provider,
    model,
    status,
    validationStatus: fields.validationStatus ?? "requires_review",
    createdAt: new Date(),
    ...fields,
  } satisfies typeof investigationSyntheses.$inferInsert;
  await getDb().insert(investigationSyntheses).values(row);
  return row.id;
}

async function finalizeHistory(id: string, fields: Partial<typeof investigationSyntheses.$inferInsert>) {
  await getDb().update(investigationSyntheses).set(fields).where(eq(investigationSyntheses.id, id));
}

export async function synthesizeInvestigation(investigationId: string): Promise<SynthesisRunSummary> {
  const running = await getDb().select({ id: investigationSyntheses.id }).from(investigationSyntheses).where(and(eq(investigationSyntheses.investigationId, investigationId), eq(investigationSyntheses.status, "running"))).limit(1);
  if (running[0]) throw new Error("An investigation synthesis is already running.");
  const detail = await getInvestigationDetail(investigationId, { includeEvidence: true });
  if (!detail) throw new Error("Investigation not found.");
  const aggregates = await calculateInvestigationAggregates(investigationId);
  if (aggregates.evidence.total === 0) throw new Error("No usable evidence is available for synthesis.");
  const input = await buildInvestigationSynthesisInput(detail, aggregates);
  const synthesisId = await createHistory(investigationId, "router", null, "running", { aggregates: aggregates as unknown as Record<string, unknown> });
  try {
    const routerResult = await generateWithFallback({ messages: [{ role: "system", content: INVESTIGATION_SYNTHESIS_SYSTEM_PROMPT }, { role: "user", content: buildInvestigationSynthesisUserPrompt(input) }], temperature: 0, maxTokens: 1800, responseFormat: "json" });
    const parsed = parseInvestigationSynthesisJson(routerResult.content);
    const allowedNumbers = new Set<number>();
    const collectNumbers = (value: unknown) => { if (typeof value === "number") allowedNumbers.add(value); else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach(collectNumbers); };
    collectNumbers(input.aggregates);
    const validation = validateInvestigationSynthesis(parsed, { businessIds: new Set(input.businesses.map((business) => business.businessId)), evidenceIds: new Set(input.evidence.map((evidence) => evidence.id)), claimIds: new Set(input.claims.map((claim) => claim.id)), allowedNumbers });
    const issueRows = validation.issues as unknown as Array<Record<string, unknown>>;
    const status = validation.status === "supported" ? "completed" : "completed_with_errors";
    let findingsCreated = 0;
    let opportunitiesCreated = 0;
    let actionsCreated = 0;
    if (validation.status !== "rejected") {
      for (const finding of validation.result.findings) {
        await createFinding(investigationId, { title: finding.title, summary: finding.summary, findingType: finding.findingType, confidence: finding.confidence, businessIds: finding.businessIds, evidenceIds: finding.evidenceIds, claimIds: finding.claimIds, status: validation.status === "supported" ? "supported" : "requires_review" });
        findingsCreated += 1;
      }
      for (const opportunity of validation.result.opportunities) {
        await createOpportunity(investigationId, { title: opportunity.title, statement: opportunity.statement, confidence: opportunity.confidence, businessIds: opportunity.businessIds, evidenceIds: opportunity.evidenceIds, riskSummary: opportunity.riskSummary, status: opportunity.status });
        opportunitiesCreated += 1;
      }
      for (const action of validation.result.recommendedActions) {
        await createAction(investigationId, { title: action.title, description: action.description, priority: action.priority === "high" ? 3 : action.priority === "medium" ? 2 : 1, actionType: action.actionType, status: "todo" });
        actionsCreated += 1;
      }
    }
    await finalizeHistory(synthesisId, { provider: routerResult.metadata.provider, model: routerResult.metadata.model ?? null, status, executiveSummary: validation.result.executiveSummary, findings: validation.result.findings, opportunities: validation.result.opportunities, risks: validation.result.risks, unknowns: validation.result.unknowns, actions: validation.result.recommendedActions, validationStatus: validation.status, validationIssues: issueRows });
    return { synthesisId, status, validationStatus: validation.status, provider: routerResult.metadata.provider, model: routerResult.metadata.model ?? null, findingsCreated, opportunitiesCreated, actionsCreated, issues: validation.issues };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synthesis failed.";
    const failureDetails = typeof error === "object" && error !== null && "failureDetails" in error
      ? (error as { failureDetails?: Array<{ provider: string; status?: number; message: string }> }).failureDetails
      : undefined;
    const issue: SynthesisValidationIssue = {
      type: failureDetails?.length ? "provider_attempts_failed" : "synthesis_failure",
      path: "provider",
      message,
      value: failureDetails ?? undefined,
    };
    await finalizeHistory(synthesisId, { status: "failed", provider: "router", validationStatus: "rejected", validationIssues: [issue as unknown as Record<string, unknown>] });
    throw error;
  }
}

export type { InvestigationAggregates, InvestigationSynthesisInput };