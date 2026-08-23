import { and, desc, eq, max } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { investigations, investigationPlans, investigationPlanSteps, investigationPlanExecutions, investigationPlanExecutionSteps } from "@/lib/db/schema";
import { getInvestigationDetail } from "@/services/investigations/service";
import { newId } from "@/lib/ids";
import { addBudget, normalizeBudget } from "./budgets";
import { buildPlanTemplate } from "./templates";
import { validatePlanSteps } from "./validator";
import type { InvestigationObjectiveSnapshot, InvestigationPlan, InvestigationPlanExecution, InvestigationPlanExecutionStep, InvestigationPlanStepInput, PlanCreationResult } from "./types";

function snapshotFromInvestigation(row: typeof investigations.$inferSelect): InvestigationObjectiveSnapshot {
  const criteria = row.criteria ?? {};
  const geography = typeof criteria.geography === "object" && criteria.geography !== null ? criteria.geography as Record<string, unknown> : {};
  return {
    investigationType: row.investigationType,
    objective: row.objective,
    problemCategory: typeof criteria.problemCategory === "string" ? criteria.problemCategory : undefined,
    serviceCategory: typeof criteria.serviceCategory === "string" ? criteria.serviceCategory : undefined,
    targetIndustry: typeof criteria.targetIndustry === "string" ? criteria.targetIndustry : row.industry ?? undefined,
    geography: { country: typeof geography.country === "string" ? geography.country : row.country ?? undefined, region: typeof geography.region === "string" ? geography.region : row.region ?? undefined, city: typeof geography.city === "string" ? geography.city : row.city ?? undefined },
    criteria,
  };
}

function plannedBudget(steps: InvestigationPlanStepInput[]) {
  return steps.reduce((total, step) => addBudget(total, step.budget), normalizeBudget({}));
}

function mapPlan(row: typeof investigationPlans.$inferSelect, steps: Array<typeof investigationPlanSteps.$inferSelect>): InvestigationPlan {
  const mappedSteps = steps.sort((a, b) => a.stepOrder - b.stepOrder).map((step) => ({ id: step.id, planId: step.planId, order: step.stepOrder, type: step.type as InvestigationPlan["steps"][number]["type"], title: step.title, objective: step.objective, reason: step.reason, configuration: step.configuration ?? {}, dependencies: step.dependencies ?? [], budget: step.budget ?? {}, enabled: step.enabled === 1, status: step.status as InvestigationPlan["steps"][number]["status"] }));
  const budget = plannedBudget(mappedSteps);
  return { id: row.id, investigationId: row.investigationId, version: row.version, status: row.status as InvestigationPlan["status"], objectiveSnapshot: row.objectiveSnapshot as unknown as InvestigationPlan["objectiveSnapshot"], createdBy: row.createdBy, createdAt: row.createdAt, updatedAt: row.updatedAt, approvedAt: row.approvedAt, executedAt: row.executedAt, steps: mappedSteps, plannedBudget: budget, estimatedProviders: Array.from(new Set(mappedSteps.flatMap((step) => { const providers = step.configuration.providers; return Array.isArray(providers) ? providers.map(String) : step.configuration.provider ? [String(step.configuration.provider)] : []; }))), validationIssues: validatePlanSteps(mappedSteps), };
}

export async function createInvestigationPlan(investigationId: string, input?: { steps?: InvestigationPlanStepInput[]; createdBy?: string; objectiveSnapshot?: InvestigationObjectiveSnapshot; investigationType?: string }): Promise<PlanCreationResult> {
  let snapshot: InvestigationObjectiveSnapshot;
  
  if (input?.objectiveSnapshot) {
    snapshot = input.objectiveSnapshot;
  } else {
    const detail = await getInvestigationDetail(investigationId, { includeEvidence: false });
    if (!detail) throw new Error("Investigation not found.");
    snapshot = snapshotFromInvestigation({ ...detail, criteria: detail.criteria } as unknown as typeof investigations.$inferSelect);
  }
  
  const steps = input?.steps?.length ? input.steps : buildPlanTemplate(snapshot);
  const issues = validatePlanSteps(steps);
  const latest = await getDb().select({ version: max(investigationPlans.version) }).from(investigationPlans).where(eq(investigationPlans.investigationId, investigationId));
  const version = Number(latest[0]?.version ?? 0) + 1;
  const planId = newId();
  const now = new Date();
  await getDb().insert(investigationPlans).values({ id: planId, investigationId, version, status: issues.length ? "draft" : "review", objectiveSnapshot: snapshot, createdBy: input?.createdBy ?? "investigator", createdAt: now, updatedAt: now });
  for (const step of steps) await getDb().insert(investigationPlanSteps).values({ id: newId(), planId, stepOrder: step.order, type: step.type, title: step.title, objective: step.objective, reason: step.reason, configuration: step.configuration, dependencies: step.dependencies, budget: normalizeBudget(step.budget), enabled: step.enabled ? 1 : 0, status: "planned", createdAt: now, updatedAt: now });
  return { planId, version, status: issues.length ? "draft" : "review", validationIssues: issues };
}

export async function getInvestigationPlans(investigationId: string): Promise<InvestigationPlan[]> {
  const rows = await getDb().select().from(investigationPlans).where(eq(investigationPlans.investigationId, investigationId)).orderBy(desc(investigationPlans.version));
  return Promise.all(rows.map(async (row) => mapPlan(row, await getDb().select().from(investigationPlanSteps).where(eq(investigationPlanSteps.planId, row.id)))));
}

export async function getInvestigationPlan(investigationId: string, planId: string): Promise<InvestigationPlan | null> {
  const row = (await getDb().select().from(investigationPlans).where(and(eq(investigationPlans.id, planId), eq(investigationPlans.investigationId, investigationId))).limit(1))[0];
  return row ? mapPlan(row, await getDb().select().from(investigationPlanSteps).where(eq(investigationPlanSteps.planId, planId))) : null;
}

export async function editInvestigationPlan(investigationId: string, planId: string, steps: InvestigationPlanStepInput[], createdBy = "investigator"): Promise<PlanCreationResult> {
  const plan = await getInvestigationPlan(investigationId, planId);
  if (!plan) throw new Error("Plan not found.");
  if (!["draft", "review", "approved"].includes(plan.status)) throw new Error("Only draft, review, or approved plans can be edited.");
  const result = await createInvestigationPlan(investigationId, { steps, createdBy });
  if (plan.status === "approved") await getDb().update(investigationPlans).set({ status: "superseded", updatedAt: new Date() }).where(eq(investigationPlans.id, planId));
  return result;
}

export async function approveInvestigationPlan(investigationId: string, planId: string) {
  const plan = await getInvestigationPlan(investigationId, planId);
  if (!plan) throw new Error("Plan not found.");
  if (!["draft", "review"].includes(plan.status)) throw new Error("Only draft or review plans can be approved.");
  const issues = validatePlanSteps(plan.steps);
  if (issues.length) throw new Error(`Plan validation failed: ${issues[0].message}`);
  await getDb().update(investigationPlans).set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() }).where(eq(investigationPlans.id, planId));
  return { planId, status: "approved" as const };
}

export async function getPlanExecutions(investigationId: string, planId?: string): Promise<InvestigationPlanExecution[]> {
  const executions = await getDb().select().from(investigationPlanExecutions).where(and(eq(investigationPlanExecutions.investigationId, investigationId), planId ? eq(investigationPlanExecutions.planId, planId) : undefined)).orderBy(desc(investigationPlanExecutions.createdAt));
  return Promise.all(executions.map(async (execution) => ({ id: execution.id, investigationId: execution.investigationId, planId: execution.planId, status: execution.status as InvestigationPlanExecution["status"], plannedBudget: execution.plannedBudget as InvestigationPlanExecution["plannedBudget"], actualUsage: execution.actualUsage as InvestigationPlanExecution["actualUsage"], failureReason: execution.failureReason, currentStepId: execution.currentStepId, cancellationRequested: execution.cancellationRequested === 1, startedAt: execution.startedAt, completedAt: execution.completedAt, steps: (await getDb().select().from(investigationPlanExecutionSteps).where(eq(investigationPlanExecutionSteps.executionId, execution.id))).map((step): InvestigationPlanExecutionStep => ({ id: step.id, executionId: step.executionId, planStepId: step.planStepId, status: step.status as InvestigationPlanExecutionStep["status"], provider: step.provider, searchRunIds: step.searchRunIds ?? [], outputIds: step.outputIds ?? [], actualUsage: step.actualUsage ?? {}, reason: step.reason, errorCategory: step.errorCategory, safeMessage: step.safeMessage, startedAt: step.startedAt, completedAt: step.completedAt })) })));
}