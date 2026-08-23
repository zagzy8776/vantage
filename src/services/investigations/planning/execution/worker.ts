import { normalizeBudget } from "../budgets";
import type { InvestigationPlan, InvestigationPlanBudget, InvestigationPlanExecution, InvestigationPlanExecutionProviderUsage, InvestigationPlanExecutionStep, InvestigationPlanStep } from "../types";
import { buildExecutionStatusView, classifyFailure, firstExhaustedKey, isActiveExecutionStatus, isTerminalExecutionStatus, mergeProviderUsage, remainingBudget, resolveNextStep, staleRunningStepIds, sumUsage, terminalExecutionStatus, usageDelta } from "./engine";
import type { StepDecision } from "./engine";
import type { ExecutionStore } from "./store";

export const STALE_LOCK_MS = 120_000;
export const STEP_INTERRUPTION_MS = 15 * 60_000;
export const MONITOR_POLL_MS = 3_000;
export const MONITOR_MAX_MS = 30 * 60_000;
export const SWEEP_INTERVAL_MS = 5_000;

export interface SearchRunSnapshot {
  id: string;
  status: string;
  providers?: string[] | null;
  tavilyQueries?: number;
  exaQueries?: number;
  firecrawlEnriched?: number;
  discoveredCount?: number;
  candidatesReturned?: number;
  failures?: Array<Record<string, unknown>> | null;
  durationMs?: number | null;
  stages?: Record<string, { count?: number }> | null;
  providerMetrics?: Record<string, unknown> | null;
}

export interface DiscoveryQueryInput { category: string; country: string; city?: string; region?: string; limit: number; depth: "quick" | "standard" | "deep"; searchSource: "best-available"; queryExpansion: boolean; evidenceEnrichment: boolean; webDiscoveryProvider: "best-available" }

export interface WorkerDeps {
  store: ExecutionStore;
  now(): Date;
  logEvent(event: Record<string, unknown>): void;
  getPlan(investigationId: string, planId: string): Promise<InvestigationPlan | null>;
  createSearchRun(query: DiscoveryQueryInput): Promise<string>;
  attachSearchRun(investigationId: string, searchRunId: string): Promise<void>;
  runDiscovery(query: DiscoveryQueryInput, searchRunId: string): Promise<unknown>;
  getSearchRun(searchRunId: string): Promise<SearchRunSnapshot | null>;
  synthesizeProblem(investigationId: string): Promise<{ synthesisId: string }>;
  synthesizeMarket(investigationId: string): Promise<{ synthesisId: string }>;
  linkEvidenceTrace(input: { investigationId: string; searchRunIds: string[]; planId: string; planStepId: string; executionId: string }): Promise<number>;
}

const EXTERNAL_STEP_TYPES = new Set(["discover_businesses", "web_search"]);
const SYNTHESIS_STEP_TYPES = new Set(["synthesize_problem", "synthesize_market"]);
const LOCAL_STEP_TYPES = new Set(["interpret_objective", "expand_query", "verify_business", "research_website", "analyze_website"]);

function queryForStep(plan: InvestigationPlan, step: InvestigationPlanStep, category: string, candidateLimit: number): DiscoveryQueryInput {
  const geography = plan.objectiveSnapshot.geography;
  return { category, country: geography.country ?? "", city: geography.city, region: geography.region, limit: Math.max(1, Math.min(Number(step.configuration.limit ?? 10) || 10, 40, candidateLimit)), depth: "deep", searchSource: "best-available", queryExpansion: true, evidenceEnrichment: true, webDiscoveryProvider: "best-available" };
}

function categoriesForStep(plan: InvestigationPlan, step: InvestigationPlanStep): string[] {
  const configured = Array.isArray(step.configuration.categories) ? step.configuration.categories.map(String) : [];
  const categories = configured.length ? configured : [plan.objectiveSnapshot.targetIndustry ?? "relevant businesses"];
  return categories.slice(0, Math.max(1, step.budget.businessProviderQueries || 1));
}

function isTerminalRun(status: string | undefined) { return status === "completed" || status === "completed_with_errors" || status === "failed"; }

function usageFromRuns(runs: SearchRunSnapshot[]): Partial<InvestigationPlanBudget> {
  return {
    businessProviderQueries: runs.reduce((total, run) => total + (run.providers?.length ?? 0), 0),
    webSearchQueries: runs.reduce((total, run) => total + (run.tavilyQueries ?? 0) + (run.exaQueries ?? 0), 0),
    candidates: runs.reduce((total, run) => total + (run.discoveredCount ?? 0), 0),
    firecrawlPages: runs.reduce((total, run) => total + (run.firecrawlEnriched ?? 0), 0),
    pagespeedAnalyses: runs.reduce((total, run) => total + (run.stages?.pagespeed?.count ?? 0), 0),
    totalExternalRequests: runs.reduce((total, run) => total + (run.providers?.length ?? 0) + (run.tavilyQueries ?? 0) + (run.exaQueries ?? 0) + (run.firecrawlEnriched ?? 0), 0),
  };
}

function providerUsageFromRun(run: SearchRunSnapshot, stage: string): InvestigationPlanExecutionProviderUsage[] {
  const failuresFor = (provider: string) => (run.failures ?? []).filter((failure) => String(failure.provider ?? "") === provider).length;
  const entries: InvestigationPlanExecutionProviderUsage[] = [];
  for (const provider of run.providers ?? []) entries.push({ provider, stage, requests: 1, results: run.discoveredCount ?? 0, failures: failuresFor(provider), durationMs: run.durationMs ?? null });
  if ((run.tavilyQueries ?? 0) > 0) entries.push({ provider: "tavily", stage, requests: run.tavilyQueries ?? 0, results: 0, failures: failuresFor("tavily"), durationMs: null });
  if ((run.exaQueries ?? 0) > 0) entries.push({ provider: "exa", stage, requests: run.exaQueries ?? 0, results: 0, failures: failuresFor("exa"), durationMs: null });
  if ((run.firecrawlEnriched ?? 0) > 0) entries.push({ provider: "firecrawl", stage, requests: run.firecrawlEnriched ?? 0, results: run.firecrawlEnriched ?? 0, failures: failuresFor("firecrawl"), durationMs: null });
  const pagespeedRequests = run.stages?.pagespeed?.count ?? 0;
  if (pagespeedRequests > 0) entries.push({ provider: "pagespeed", stage, requests: pagespeedRequests, results: pagespeedRequests, failures: failuresFor("pagespeed"), durationMs: null });
  return entries;
}

export class ExecutionWorker {
  private readonly driving = new Set<string>();

  constructor(private readonly deps: WorkerDeps) {}

  private async finalize(executionId: string, planId: string, status: "completed" | "completed_with_errors" | "failed" | "cancelled", reason: string | null) {
    await this.deps.store.patchExecution(executionId, { status, failureReason: reason, completedAt: this.deps.now(), workerId: null, lockAcquiredAt: null });
    await this.deps.store.markPlanReleased(planId);
    this.driving.delete(executionId);
    this.deps.logEvent({ diagnostic: "execution_finalized", executionId, status });
  }

  private async cancelPendingSteps(execution: InvestigationPlanExecution) {
    for (const step of execution.steps.filter((candidate) => ["planned", "ready", "blocked"].includes(candidate.status))) {
      await this.deps.store.patchStep(step.id, { status: "cancelled", reason: "Cancelled before step start.", completedAt: this.deps.now() });
    }
  }

  private async reconcileSearchRunStep(execution: InvestigationPlanExecution, step: InvestigationPlanExecutionStep): Promise<boolean> {
    const runs = (await Promise.all(step.searchRunIds.map((runId) => this.deps.getSearchRun(runId)))).filter((run): run is SearchRunSnapshot => Boolean(run));
    if (!runs.length || runs.some((run) => !isTerminalRun(run.status))) return false;
    const measured = usageFromRuns(runs);
    const providerEntries = runs.flatMap((run) => providerUsageFromRun(run, "search_run"));
    const failed = runs.some((run) => run.status === "failed" || run.status === "completed_with_errors");
    const partial = runs.some((run) => run.status !== "completed");
    const reserved = normalizeBudget(step.actualUsage);
    await this.deps.store.patchStep(step.id, {
      status: failed ? "completed_with_errors" : "completed",
      provider: "existing-discovery-pipeline",
      actualUsage: normalizeBudget(measured),
      reason: partial ? "Search Run completed with provider errors." : "Search Run completed.",
      errorCategory: failed ? "search_run_failure" : partial ? "partial_provider_failure" : null,
      safeMessage: partial ? "The approved discovery run completed with recorded provider errors." : null,
      completedAt: this.deps.now(),
    });
    const delta = usageDelta(reserved, measured);
    if (Object.keys(delta).length) await this.deps.store.addUsage(execution.id, delta);
    await this.deps.store.recordProviderUsage(execution.id, providerEntries);
    this.deps.logEvent({ diagnostic: "step_reconciled", executionId: execution.id, stepId: step.id, status: failed ? "completed_with_errors" : "completed", searchRunIds: step.searchRunIds });
    return true;
  }

  private async launchDiscoveryStep(execution: InvestigationPlanExecution, plan: InvestigationPlan, step: InvestigationPlanExecutionStep, planStep: InvestigationPlanStep): Promise<"waiting" | "blocked"> {
    let launched = false;
    const categories = categoriesForStep(plan, planStep);
    for (const category of categories) {
      const required: Partial<InvestigationPlanBudget> = { businessProviderQueries: 1, totalExternalRequests: 1 };
      const exhaustedKey = firstExhaustedKey(execution.plannedBudget, execution.actualUsage, required);
      if (exhaustedKey) {
        await this.deps.store.patchStep(step.id, { status: "blocked", reason: `Approved budget exhausted (${exhaustedKey}).`, errorCategory: "budget_exhausted", safeMessage: "The approved external request budget was exhausted before this request.", completedAt: this.deps.now() });
        return "blocked";
      }
      const remaining = remainingBudget(execution.plannedBudget, execution.actualUsage);
      const searchRunId = await this.deps.createSearchRun(queryForStep(plan, planStep, category, remaining.candidates));
      await this.deps.attachSearchRun(execution.investigationId, searchRunId);
      const searchRunIds = [...(step.searchRunIds ?? []), searchRunId];
      await this.deps.store.patchStep(step.id, { searchRunIds, provider: "existing-discovery-pipeline", reason: "Search Run created; durable worker monitors its lifecycle.", actualUsage: sumUsage([step.actualUsage, required]) });
      await this.deps.store.addUsage(execution.id, required);
      step = { ...step, searchRunIds };
      launched = true;
      const query = queryForStep(plan, planStep, category, remaining.candidates);
      // Implement bounded retry logic for provider failures
      let retryCount = 0;
      const maxRetries = 2;
      let retryDelay = 100; // Reduced from 1000ms for faster testing

      const attemptDiscovery = async () => {
        try {
          await this.deps.runDiscovery(query, searchRunId);
        } catch (error) {
          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2; // Exponential backoff
            await attemptDiscovery();
            return;
          }
          await this.deps.store.patchStep(step.id, {
            status: "completed_with_errors",
            reason: `Discovery failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
            errorCategory: "provider_error",
            safeMessage: "The discovery provider failed after retry attempts.",
            completedAt: this.deps.now()
          });
        }
      };

      await attemptDiscovery().catch(() => undefined);
    }
    if (!launched) {
      await this.deps.store.patchStep(step.id, { status: "skipped", reason: "No categories configured.", completedAt: this.deps.now() });
    }
    return "waiting";
  }

  private async launchSynthesisStep(execution: InvestigationPlanExecution, step: InvestigationPlanExecutionStep, planStep: InvestigationPlanStep): Promise<"waiting"> {
    const startedAt = this.deps.now();
    const required: Partial<InvestigationPlanBudget> = { aiCalls: 1, totalExternalRequests: 1 };
    void (async () => {
      try {
        const result = planStep.type === "synthesize_problem" ? await this.deps.synthesizeProblem(execution.investigationId) : await this.deps.synthesizeMarket(execution.investigationId);
        const applied = await this.deps.store.patchStepWhileRunning(step.id, { status: "completed", provider: "router", outputIds: result.synthesisId ? [result.synthesisId] : [], actualUsage: normalizeBudget(required), reason: "Synthesis completed.", completedAt: this.deps.now() });
        if (applied) {
          await this.deps.store.addUsage(execution.id, required);
          await this.deps.store.recordProviderUsage(execution.id, [{ provider: "router", stage: "synthesis", requests: 1, results: 1, failures: 0, durationMs: this.deps.now().getTime() - startedAt.getTime() }]);
        }
        this.deps.logEvent({ diagnostic: "synthesis_completed", executionId: execution.id, stepId: step.id, applied });
      } catch (error) {
        const failure = classifyFailure(error);
        await this.deps.store.patchStepWhileRunning(step.id, { status: "failed", reason: failure.message, errorCategory: failure.category, safeMessage: "Synthesis provider failed; no findings were produced.", completedAt: this.deps.now() });
        this.deps.logEvent({ diagnostic: "synthesis_failed", executionId: execution.id, stepId: step.id, category: failure.category });
      }
    })();
    return "waiting";
  }

  private async completeLocalStep(execution: InvestigationPlanExecution, step: InvestigationPlanExecutionStep, planStep: InvestigationPlanStep): Promise<void> {
    if (planStep.type === "collect_evidence") {
      const searchRunIds = execution.steps.flatMap((candidate) => candidate.searchRunIds);
      const linked = await this.deps.linkEvidenceTrace({ investigationId: execution.investigationId, searchRunIds, planId: execution.planId, planStepId: planStep.id, executionId: execution.id });
      await this.deps.store.patchStep(step.id, { status: "completed", reason: `Evidence linked to execution (${linked} items).`, completedAt: this.deps.now() });
      return;
    }
    await this.deps.store.patchStep(step.id, { status: "completed", reason: LOCAL_STEP_TYPES.has(planStep.type) ? "Local planning step completed without external calls." : "Step completed.", completedAt: this.deps.now() });
  }

  private async applyDecisionAndLaunch(execution: InvestigationPlanExecution, plan: InvestigationPlan, decision: StepDecision): Promise<"progressed" | "waiting"> {
    const { step } = decision;
    const planStep = plan.steps.find((candidate) => candidate.id === step.planStepId)!;
    if (decision.kind !== "launch") {
      await this.deps.store.patchStep(step.id, { status: decision.kind === "skip" ? "skipped" : "blocked", reason: decision.reason, completedAt: this.deps.now(), ...(decision.kind === "block" ? { errorCategory: "dependency_block" } : {}) });
      return "progressed";
    }
    if (EXTERNAL_STEP_TYPES.has(planStep.type)) {
      const required: Partial<InvestigationPlanBudget> = { totalExternalRequests: 1 };
      if (firstExhaustedKey(execution.plannedBudget, execution.actualUsage, required)) {
        await this.deps.store.patchStep(step.id, { status: "blocked", reason: "Approved budget exhausted (totalExternalRequests).", errorCategory: "budget_exhausted", safeMessage: "The approved external request budget was exhausted.", completedAt: this.deps.now() });
        return "progressed";
      }
      await this.deps.store.patchExecution(execution.id, { currentStepId: step.id });
      await this.deps.store.patchStep(step.id, { status: "running", startedAt: this.deps.now(), reason: null, errorCategory: null, safeMessage: null });
      const outcome = await this.launchDiscoveryStep(execution, plan, step, planStep);
      return outcome === "waiting" ? "waiting" : "progressed";
    }
    if (SYNTHESIS_STEP_TYPES.has(planStep.type)) {
      const required: Partial<InvestigationPlanBudget> = { aiCalls: 1, totalExternalRequests: 1 };
      const exhaustedKey = firstExhaustedKey(execution.plannedBudget, execution.actualUsage, required);
      if (exhaustedKey) {
        await this.deps.store.patchStep(step.id, { status: "blocked", reason: `Approved budget exhausted (${exhaustedKey}).`, errorCategory: "budget_exhausted", safeMessage: "The approved AI budget was exhausted before synthesis.", completedAt: this.deps.now() });
        return "progressed";
      }
      await this.deps.store.patchExecution(execution.id, { currentStepId: step.id });
      await this.deps.store.patchStep(step.id, { status: "running", startedAt: this.deps.now(), reason: null, errorCategory: null, safeMessage: null });
      return this.launchSynthesisStep(execution, step, planStep);
    }
    await this.deps.store.patchExecution(execution.id, { currentStepId: step.id });
    await this.deps.store.patchStep(step.id, { status: "running", startedAt: this.deps.now(), reason: null, errorCategory: null, safeMessage: null });
    await this.completeLocalStep(execution, step, planStep);
    return "progressed";
  }

  async tick(investigationId: string, executionId: string): Promise<InvestigationPlanExecution | null> {
    const workerId = `worker_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const initial = await this.deps.store.loadExecution(investigationId, executionId);
    if (!initial || isTerminalExecutionStatus(initial.status)) return initial;
    if (!(await this.deps.store.claimExecution(executionId, workerId, STALE_LOCK_MS))) return this.deps.store.loadExecution(investigationId, executionId);

    let execution = await this.deps.store.loadExecution(investigationId, executionId);
    const plan = execution ? await this.deps.getPlan(investigationId, execution.planId) : null;
    try {
      if (!execution) return null;
      if (!plan) {
        await this.finalize(executionId, execution.planId, "failed", "Approved plan disappeared during execution.");
        return this.deps.store.loadExecution(investigationId, executionId);
      }

      if (execution.cancellationRequested) {
        await this.cancelPendingSteps(execution);
        execution = (await this.deps.store.loadExecution(investigationId, executionId))!;
        if (!execution.steps.some((step) => step.status === "running")) {
          await this.finalize(executionId, execution.planId, "cancelled", "Cancelled by investigator.");
          return this.deps.store.loadExecution(investigationId, executionId);
        }
      }

      for (const step of execution.steps.filter((candidate) => candidate.status === "running" && candidate.searchRunIds.length)) {
        await this.reconcileSearchRunStep(execution, step);
      }

      execution = (await this.deps.store.loadExecution(investigationId, executionId))!;

      for (const staleStepId of staleRunningStepIds(execution, this.deps.now(), STEP_INTERRUPTION_MS)) {
        await this.deps.store.patchStep(staleStepId, { status: "failed", reason: "Process interrupted before the step finished.", errorCategory: "process_interruption", safeMessage: "The worker restarted before this step completed.", completedAt: this.deps.now() });
        this.deps.logEvent({ diagnostic: "step_interrupted", executionId, stepId: staleStepId });
      }

      for (let guard = 0; guard <= execution.steps.length + 2; guard += 1) {
        execution = (await this.deps.store.loadExecution(investigationId, executionId))!;

        if (execution.cancellationRequested && !execution.steps.some((step) => step.status === "running")) {
          await this.cancelPendingSteps(execution);
          execution = (await this.deps.store.loadExecution(investigationId, executionId))!;
          await this.finalize(executionId, execution.planId, "cancelled", "Cancelled by investigator.");
          return execution;
        }

        if (execution.steps.some((step) => step.status === "running")) return execution;

        const decision = resolveNextStep(plan, execution);
        if (!decision) {
          const failedOrBlocked = execution.steps.filter((step) => ["failed", "blocked"].includes(step.status));
          const status = terminalExecutionStatus(execution, { cancellationRequested: execution.cancellationRequested });
          await this.finalize(executionId, execution.planId, status, failedOrBlocked.length ? "One or more execution steps did not complete cleanly." : null);
          return this.deps.store.loadExecution(investigationId, executionId);
        }

        const outcome = await this.applyDecisionAndLaunch(execution, plan, decision);
        if (outcome === "waiting") return this.deps.store.loadExecution(investigationId, executionId);
      }
      return this.deps.store.loadExecution(investigationId, executionId);
    } finally {
      const current = await this.deps.store.loadExecution(investigationId, executionId);
      if (current && isActiveExecutionStatus(current.status) && current.workerId === workerId) {
        await this.deps.store.patchExecution(executionId, { workerId: null, lockAcquiredAt: null });
      }
    }
  }

  async drive(investigationId: string, executionId: string): Promise<InvestigationPlanExecution | null> {
    if (this.driving.has(executionId)) return this.deps.store.loadExecution(investigationId, executionId);
    this.driving.add(executionId);
    const deadline = this.deps.now().getTime() + MONITOR_MAX_MS;
    try {
      let execution = await this.deps.store.loadExecution(investigationId, executionId);
      while (execution && isActiveExecutionStatus(execution.status) && this.deps.now().getTime() < deadline) {
        execution = await this.tick(investigationId, executionId);
        if (!execution || isTerminalExecutionStatus(execution.status)) break;
        const stillActive = (await this.deps.store.loadExecution(investigationId, executionId))!;
        if (!isActiveExecutionStatus(stillActive.status)) { execution = stillActive; break; }
        await new Promise((resolve) => setTimeout(resolve, MONITOR_POLL_MS));
      }
      return execution ?? this.deps.store.loadExecution(investigationId, executionId);
    } finally {
      this.driving.delete(executionId);
    }
  }

  async recoverActiveExecutions(): Promise<Array<{ id: string; investigationId: string }>> {
    const refs = await this.deps.store.listActiveExecutionRefs();
    for (const ref of refs) void this.drive(ref.investigationId, ref.id).catch(() => undefined);
    return refs;
  }

  buildStatusView(plan: InvestigationPlan, execution: InvestigationPlanExecution) {
    return buildExecutionStatusView(plan, execution);
  }

  mergeProviderUsageRecords(existing: InvestigationPlanExecutionProviderUsage[], additions: InvestigationPlanExecutionProviderUsage[]) {
    return mergeProviderUsage(existing, additions);
  }
}
