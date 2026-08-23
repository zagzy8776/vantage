import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { investigationPlanExecutionSteps, investigationPlanExecutions, investigationPlans } from "@/lib/db/schema";
import { normalizeBudget } from "../budgets";
import { mergeProviderUsage } from "./engine";
import type { InvestigationPlanBudget, InvestigationPlanExecution, InvestigationPlanExecutionProviderUsage, InvestigationPlanExecutionStep, InvestigationPlanStepInput } from "../types";

export interface CreateExecutionInput { investigationId: string; planId: string; plannedBudget: InvestigationPlanBudget; orderedPlanSteps: InvestigationPlanStepInput[] }

export type ExecutionPatch = Partial<{ status: string; currentStepId: string | null; failureReason: string | null; completedAt: Date | null; actualUsage: Record<string, number>; providerUsage: InvestigationPlanExecutionProviderUsage[]; cancellationRequested: number; workerId: string | null; lockAcquiredAt: Date | null }>;
export type ExecutionStepPatch = Partial<Omit<InvestigationPlanExecutionStep, "id" | "executionId" | "planStepId" | "actualUsage">> & { actualUsage?: Record<string, number> };

export interface ExecutionStore {
  findActiveExecutionIdByPlan(planId: string): Promise<string | null>;
  createQueuedExecution(input: CreateExecutionInput): Promise<string>;
  loadExecution(investigationId: string, executionId: string): Promise<InvestigationPlanExecution | null>;
  claimExecution(executionId: string, workerId: string, staleAfterMs: number): Promise<boolean>;
  patchExecution(executionId: string, patch: ExecutionPatch): Promise<void>;
  patchStep(stepId: string, patch: ExecutionStepPatch): Promise<void>;
  patchStepWhileRunning(stepId: string, patch: ExecutionStepPatch): Promise<boolean>;
  recordProviderUsage(executionId: string, additions: InvestigationPlanExecutionProviderUsage[]): Promise<void>;
  addUsage(executionId: string, addition: Partial<InvestigationPlanBudget>): Promise<InvestigationPlanBudget>;
  listActiveExecutionRefs(): Promise<Array<{ id: string; investigationId: string; planId: string }>>;
  markPlanExecuting(planId: string): Promise<void>;
  markPlanReleased(planId: string): Promise<void>;
}

function mapExecution(row: typeof investigationPlanExecutions.$inferSelect, steps: Array<typeof investigationPlanExecutionSteps.$inferSelect>): InvestigationPlanExecution {
  return {
    id: row.id,
    investigationId: row.investigationId,
    planId: row.planId,
    status: row.status as InvestigationPlanExecution["status"],
    plannedBudget: normalizeBudget(row.plannedBudget),
    actualUsage: normalizeBudget(row.actualUsage),
    providerUsage: (row.providerUsage ?? []) as unknown as InvestigationPlanExecutionProviderUsage[],
    failureReason: row.failureReason,
    currentStepId: row.currentStepId,
    cancellationRequested: row.cancellationRequested === 1,
    workerId: row.workerId,
    lockAcquiredAt: row.lockAcquiredAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    steps: steps.map((step) => ({ id: step.id, executionId: step.executionId, planStepId: step.planStepId, status: step.status as InvestigationPlanExecutionStep["status"], provider: step.provider, searchRunIds: step.searchRunIds ?? [], outputIds: step.outputIds ?? [], actualUsage: step.actualUsage ?? {}, reason: step.reason, errorCategory: step.errorCategory, safeMessage: step.safeMessage, startedAt: step.startedAt, completedAt: step.completedAt })),
  };
}

async function readExecutionRow(executionId: string) {
  return (await getDb().select().from(investigationPlanExecutions).where(eq(investigationPlanExecutions.id, executionId)).limit(1))[0] ?? null;
}

export const databaseExecutionStore: ExecutionStore = {
  async findActiveExecutionIdByPlan(planId) {
    const rows = await getDb().select({ id: investigationPlanExecutions.id }).from(investigationPlanExecutions).where(and(eq(investigationPlanExecutions.planId, planId), inArray(investigationPlanExecutions.status, ["created", "queued", "running"]))).orderBy(desc(investigationPlanExecutions.createdAt)).limit(1);
    return rows[0]?.id ?? null;
  },

  async createQueuedExecution(input) {
    const executionId = `planexec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    await getDb().insert(investigationPlanExecutions).values({ id: executionId, investigationId: input.investigationId, planId: input.planId, status: "queued", plannedBudget: input.plannedBudget, actualUsage: {}, providerUsage: [], startedAt: now, createdAt: now });
    for (let index = 0; index < input.orderedPlanSteps.length; index += 1) {
      const step = input.orderedPlanSteps[index];
      await getDb().insert(investigationPlanExecutionSteps).values({ id: `planstep_${executionId}_${index}`, executionId, planStepId: step.id!, status: index === 0 ? "ready" : "planned", searchRunIds: [], outputIds: [], actualUsage: {} });
    }
    return executionId;
  },

  async loadExecution(investigationId, executionId) {
    const row = (await getDb().select().from(investigationPlanExecutions).where(and(eq(investigationPlanExecutions.id, executionId), eq(investigationPlanExecutions.investigationId, investigationId))).limit(1))[0];
    if (!row) return null;
    const steps = await getDb().select().from(investigationPlanExecutionSteps).where(eq(investigationPlanExecutionSteps.executionId, executionId));
    return mapExecution(row, steps);
  },

  async claimExecution(executionId, workerId, staleAfterMs) {
    const stale = new Date(Date.now() - staleAfterMs);
    const rows = await getDb().update(investigationPlanExecutions).set({ status: "running", workerId, lockAcquiredAt: new Date() }).where(and(
      eq(investigationPlanExecutions.id, executionId),
      or(eq(investigationPlanExecutions.status, "queued"), and(eq(investigationPlanExecutions.status, "running"), lt(investigationPlanExecutions.lockAcquiredAt, stale))),
    )).returning({ id: investigationPlanExecutions.id });
    return rows.length > 0;
  },

  async patchExecution(executionId, patch) {
    await getDb().update(investigationPlanExecutions).set(patch).where(eq(investigationPlanExecutions.id, executionId));
  },

  async patchStep(stepId, patch) {
    await getDb().update(investigationPlanExecutionSteps).set(patch).where(eq(investigationPlanExecutionSteps.id, stepId));
  },

  async patchStepWhileRunning(stepId, patch) {
    const rows = await getDb().update(investigationPlanExecutionSteps).set(patch).where(and(eq(investigationPlanExecutionSteps.id, stepId), eq(investigationPlanExecutionSteps.status, "running"))).returning({ id: investigationPlanExecutionSteps.id });
    return rows.length > 0;
  },

  async recordProviderUsage(executionId, additions) {
    if (!additions.length) return;
    const row = await readExecutionRow(executionId);
    const merged = mergeProviderUsage(((row?.providerUsage ?? []) as unknown as InvestigationPlanExecutionProviderUsage[]) ?? [], additions);
    await getDb().update(investigationPlanExecutions).set({ providerUsage: merged }).where(eq(investigationPlanExecutions.id, executionId));
  },

  async addUsage(executionId, addition) {
    const row = await readExecutionRow(executionId);
    const current = normalizeBudget(row?.actualUsage ?? {});
    const next = normalizeBudget(Object.fromEntries(Object.keys(current).map((key) => [key, current[key as keyof InvestigationPlanBudget] + Number(addition[key as keyof InvestigationPlanBudget] ?? 0)])));
    await getDb().update(investigationPlanExecutions).set({ actualUsage: next }).where(eq(investigationPlanExecutions.id, executionId));
    return next;
  },

  async listActiveExecutionRefs() {
    const rows = await getDb().select({ id: investigationPlanExecutions.id, investigationId: investigationPlanExecutions.investigationId, planId: investigationPlanExecutions.planId }).from(investigationPlanExecutions).where(inArray(investigationPlanExecutions.status, ["created", "queued", "running"])).orderBy(desc(investigationPlanExecutions.startedAt)).limit(25);
    return rows;
  },

  async markPlanExecuting(planId) {
    await getDb().update(investigationPlans).set({ status: "executing", updatedAt: new Date() }).where(eq(investigationPlans.id, planId));
  },

  async markPlanReleased(planId) {
    await getDb().update(investigationPlans).set({ status: "approved", updatedAt: new Date() }).where(eq(investigationPlans.id, planId));
  },
};

export { readExecutionRow };
