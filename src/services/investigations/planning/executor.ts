import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidenceItems } from "@/lib/db/schema";
import { discoverBusinesses } from "@/lib/discover/service";
import { createSearchRun, getSearchRun } from "@/services/search-runs/service";
import { attachSearchRun } from "@/services/investigations/service";
import { synthesizeOpportunityInvestigation } from "@/services/investigations/opportunity/synthesizer";
import { synthesizeMarket } from "@/services/investigations/market/synthesizer";
import { getInvestigationPlan } from "./planner";
import type { DiscoveryQuery } from "@/providers/business/types";
import type { ExecutionStatusView, InvestigationPlanExecution } from "./types";
import { isTerminalExecutionStatus } from "./execution/engine";
import { databaseExecutionStore, readExecutionRow } from "./execution/store";
import type { SearchRunSnapshot } from "./execution/worker";
import { ExecutionWorker, SWEEP_INTERVAL_MS, STALE_LOCK_MS, STEP_INTERRUPTION_MS } from "./execution/worker";

export { STALE_LOCK_MS, STEP_INTERRUPTION_MS, SWEEP_INTERVAL_MS };

function toSnapshot(row: Awaited<ReturnType<typeof getSearchRun>>): SearchRunSnapshot | null {
  if (!row) return null;
  return { id: row.id, status: row.status, providers: row.providers ?? null, tavilyQueries: row.tavilyQueries, exaQueries: row.exaQueries, firecrawlEnriched: row.firecrawlEnriched, discoveredCount: row.discoveredCount, candidatesReturned: row.candidatesReturned, failures: row.failures ?? null, durationMs: row.durationMs ?? null, stages: row.stages as SearchRunSnapshot["stages"] ?? null, providerMetrics: row.providerMetrics ?? null };
}

function toDiscoveryQuery(query: { category: string; country: string; city?: string; region?: string; limit: number; depth: "quick" | "standard" | "deep"; searchSource: "best-available"; queryExpansion: boolean; evidenceEnrichment: boolean; webDiscoveryProvider: "best-available" }): DiscoveryQuery {
  return { category: query.category, country: query.country, city: query.city, region: query.region, limit: query.limit, depth: query.depth, searchSource: query.searchSource, queryExpansion: query.queryExpansion, evidenceEnrichment: query.evidenceEnrichment, webDiscoveryProvider: query.webDiscoveryProvider };
}

const sharedWorker = new ExecutionWorker({
  store: databaseExecutionStore,
  now: () => new Date(),
  logEvent: (event) => console.info(JSON.stringify(event)),
  getPlan: (investigationId, planId) => getInvestigationPlan(investigationId, planId),
  createSearchRun: async (query) => createSearchRun(toDiscoveryQuery(query)),
  attachSearchRun: (investigationId, searchRunId) => attachSearchRun(investigationId, searchRunId, "supplemental"),
  runDiscovery: async (query, searchRunId) => discoverBusinesses(toDiscoveryQuery(query), searchRunId),
  getSearchRun: async (searchRunId) => toSnapshot(await getSearchRun(searchRunId)),
  synthesizeProblem: async (investigationId) => synthesizeOpportunityInvestigation(investigationId),
  synthesizeMarket: (investigationId) => synthesizeMarket(investigationId),
  linkEvidenceTrace: async ({ searchRunIds, planId, planStepId, executionId }) => {
    const rows = searchRunIds.length ? await getDb().select({ id: evidenceItems.id, metadata: evidenceItems.metadata }).from(evidenceItems).where(inArray(evidenceItems.runId, searchRunIds)) : [];
    for (const row of rows) {
      await getDb().update(evidenceItems).set({ metadata: { ...(row.metadata ?? {}), trace: { planId, planStepId, executionId, searchRunIds } } }).where(eq(evidenceItems.id, row.id));
    }
    return rows.length;
  },
});

export function getExecutionWorker() { return sharedWorker; }

export async function createQueuedInvestigationPlanExecution(investigationId: string, planId: string): Promise<InvestigationPlanExecution> {
  const plan = await getInvestigationPlan(investigationId, planId);
  if (!plan) throw new Error("Plan not found.");
  if (plan.status !== "approved") throw new Error("Only approved plans can be executed.");
  const active = await databaseExecutionStore.findActiveExecutionIdByPlan(planId);
  if (active) throw new Error("A plan execution is already running.");
  const executionId = await databaseExecutionStore.createQueuedExecution({ investigationId, planId, plannedBudget: plan.plannedBudget, orderedPlanSteps: plan.steps });
  await databaseExecutionStore.markPlanExecuting(planId);
  const execution = await databaseExecutionStore.loadExecution(investigationId, executionId);
  if (!execution) throw new Error("Failed to create execution.");
  return execution;
}

export async function executeInvestigationPlan(investigationId: string, planId: string): Promise<{ executionId: string; investigationId: string; planId: string; status: "queued" }> {
  const execution = await createQueuedInvestigationPlanExecution(investigationId, planId);
  void sharedWorker.drive(investigationId, execution.id).catch(() => undefined);
  return { executionId: execution.id, investigationId, planId, status: "queued" };
}

export async function runInvestigationExecutionWorker(investigationId: string, executionId: string) {
  return sharedWorker.tick(investigationId, executionId);
}

export const reconcileInvestigationPlanExecution = runInvestigationExecutionWorker;

/**
 * Bounded reconciliation for scheduled (cron) invocation on serverless.
 * Processes at most maxExecutions active plan executions, one worker tick
 * each. Since launches are durable handoffs (Search Runs queued for the
 * recovery sweeper), a tick never blocks on multi-minute provider work.
 */
export async function reconcileActiveInvestigationExecutions(maxExecutions = 2): Promise<{ examined: number; processed: string[] }> {
  const refs = await databaseExecutionStore.listActiveExecutionRefs();
  const bounded = refs.slice(0, Math.max(1, maxExecutions));
  const processed: string[] = [];
  for (const ref of bounded) {
    try {
      await sharedWorker.tick(ref.investigationId, ref.id);
      processed.push(ref.id);
    } catch {
      // The next sweep retries this execution.
    }
  }
  return { examined: refs.length, processed };
}

export async function requestExecutionCancellation(investigationId: string, executionId: string): Promise<InvestigationPlanExecution | null> {
  const row = await readExecutionRow(executionId);
  if (!row || row.investigationId !== investigationId) throw new Error("Execution not found.");
  if (!isTerminalExecutionStatus(row.status)) {
    await databaseExecutionStore.patchExecution(executionId, { cancellationRequested: 1 });
    const execution = await databaseExecutionStore.loadExecution(investigationId, executionId);
    if (execution && !execution.steps.some((step) => step.status === "running")) {
      for (const step of execution.steps.filter((candidate) => ["planned", "ready", "blocked"].includes(candidate.status))) {
        await databaseExecutionStore.patchStep(step.id, { status: "cancelled", reason: "Cancelled before step start.", completedAt: new Date() });
      }
      await databaseExecutionStore.patchExecution(executionId, { status: "cancelled", failureReason: "Cancelled by investigator.", completedAt: new Date(), workerId: null, lockAcquiredAt: null });
      await databaseExecutionStore.markPlanReleased(row.planId);
    }
    void sharedWorker.tick(investigationId, executionId).catch(() => undefined);
  }
  return databaseExecutionStore.loadExecution(investigationId, executionId);
}

export async function getExecutionStatusView(investigationId: string, planId: string, executionId: string): Promise<{ view: ExecutionStatusView; execution: InvestigationPlanExecution }> {
  const [plan, execution] = await Promise.all([getInvestigationPlan(investigationId, planId), databaseExecutionStore.loadExecution(investigationId, executionId)]);
  if (!plan) throw new Error("Plan not found.");
  if (!execution || execution.planId !== planId) throw new Error("Execution not found.");
  return { view: sharedWorker.buildStatusView(plan, execution), execution };
}
