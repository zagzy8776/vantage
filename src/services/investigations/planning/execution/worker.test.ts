import { describe, expect, it, vi } from "vitest";
import { ExecutionWorker, STEP_INTERRUPTION_MS } from "./worker";
import type { ExecutionStore, CreateExecutionInput, ExecutionPatch, ExecutionStepPatch } from "./store";
import type { InvestigationPlan, InvestigationPlanExecution, InvestigationPlanExecutionStep, InvestigationPlanStep, InvestigationPlanExecutionProviderUsage, InvestigationPlanStepInput, InvestigationPlanBudget } from "../types";
import { normalizeBudget } from "../budgets";

class MockExecutionStore implements ExecutionStore {
  executions = new Map<string, InvestigationPlanExecution>();
  planExecuting = new Set<string>();

  async findActiveExecutionIdByPlan(planId: string): Promise<string | null> {
    for (const execution of Array.from(this.executions.values())) {
      if (execution.planId === planId && ["created", "queued", "running"].includes(execution.status)) {
        return execution.id;
      }
    }
    return null;
  }

  async createQueuedExecution(input: CreateExecutionInput): Promise<string> {
    const id = `exec_${Math.random().toString(36).substring(2, 7)}`;
    const execution: InvestigationPlanExecution = {
      id,
      investigationId: input.investigationId,
      planId: input.planId,
      status: "queued",
      plannedBudget: input.plannedBudget,
      actualUsage: normalizeBudget({}),
      providerUsage: [],
      failureReason: null,
      currentStepId: null,
      cancellationRequested: false,
      workerId: null,
      lockAcquiredAt: null,
      startedAt: new Date(),
      completedAt: null,
      steps: input.orderedPlanSteps.map((step, index) => ({
        id: `step_${id}_${index}`,
        executionId: id,
        planStepId: step.id!,
        status: index === 0 ? "ready" : "planned",
        provider: null,
        searchRunIds: [],
        outputIds: [],
        actualUsage: {},
        reason: null,
        errorCategory: null,
        safeMessage: null,
        startedAt: null,
        completedAt: null,
      })),
    };
    this.executions.set(id, execution);
    return id;
  }

  async loadExecution(investigationId: string, executionId: string): Promise<InvestigationPlanExecution | null> {
    const exec = this.executions.get(executionId);
    if (!exec || exec.investigationId !== investigationId) return null;
    return JSON.parse(JSON.stringify(exec)); // Return deep clone
  }

  async claimExecution(executionId: string, workerId: string, staleAfterMs: number): Promise<boolean> {
    const exec = this.executions.get(executionId);
    if (!exec) return false;
    const now = Date.now();
    const staleTime = exec.lockAcquiredAt ? exec.lockAcquiredAt.getTime() + staleAfterMs : 0;
    if (exec.status === "queued" || (exec.status === "running" && (!exec.lockAcquiredAt || now > staleTime))) {
      exec.status = "running";
      exec.workerId = workerId;
      exec.lockAcquiredAt = new Date();
      return true;
    }
    return false;
  }

  async patchExecution(executionId: string, patch: ExecutionPatch): Promise<void> {
    const exec = this.executions.get(executionId);
    if (!exec) return;
    Object.assign(exec, patch);
  }

  async patchStep(stepId: string, patch: ExecutionStepPatch): Promise<void> {
    for (const exec of Array.from(this.executions.values())) {
      const step = exec.steps.find((s: InvestigationPlanExecutionStep) => s.id === stepId);
      if (step) {
        Object.assign(step, patch);
        return;
      }
    }
  }

  async patchStepWhileRunning(stepId: string, patch: ExecutionStepPatch): Promise<boolean> {
    for (const exec of Array.from(this.executions.values())) {
      const step = exec.steps.find((s: InvestigationPlanExecutionStep) => s.id === stepId);
      if (step && step.status === "running") {
        Object.assign(step, patch);
        return true;
      }
    }
    return false;
  }

  async recordProviderUsage(executionId: string, additions: InvestigationPlanExecutionProviderUsage[]): Promise<void> {
    const exec = this.executions.get(executionId);
    if (!exec) return;
    exec.providerUsage = [...(exec.providerUsage ?? []), ...additions];
  }

  async addUsage(executionId: string, addition: Partial<InvestigationPlanBudget>): Promise<InvestigationPlanBudget> {
    const exec = this.executions.get(executionId);
    if (!exec) return normalizeBudget({});
    exec.actualUsage = normalizeBudget(Object.fromEntries(Object.keys(exec.actualUsage).map((key) => [key, (exec.actualUsage[key as keyof typeof exec.actualUsage] || 0) + (addition[key] || 0)])));
    return exec.actualUsage;
  }

  async listActiveExecutionRefs(): Promise<Array<{ id: string; investigationId: string; planId: string }>> {
    const refs = [];
    for (const exec of Array.from(this.executions.values())) {
      if (["created", "queued", "running"].includes(exec.status)) {
        refs.push({ id: exec.id, investigationId: exec.investigationId, planId: exec.planId });
      }
    }
    return refs;
  }

  async markPlanExecuting(planId: string): Promise<void> {
    this.planExecuting.add(planId);
  }

  async markPlanReleased(planId: string): Promise<void> {
    this.planExecuting.delete(planId);
  }
}

describe("ExecutionWorker", () => {
  const buildDeps = (store: MockExecutionStore, searchRunStatus = "running") => {
    let nowTime = Date.now();
    return {
      store,
      now: () => new Date(nowTime),
      setNow: (time: number) => { nowTime = time; },
      logEvent: vi.fn(),
      getPlan: async (_investigationId: string, _planId: string): Promise<InvestigationPlan | null> => ({
        id: "plan_123",
        investigationId: "inv_123",
        version: 1,
        status: "approved",
        createdBy: "test",
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedAt: new Date(),
        executedAt: null,
        plannedBudget: {
          businessProviderQueries: 8,
          webSearchQueries: 12,
          candidates: 40,
          firecrawlPages: 15,
          pagespeedAnalyses: 15,
          aiCalls: 3,
          totalExternalRequests: 60,
        },
        estimatedProviders: ["foursquare", "yelp"],
        validationIssues: [],
        objectiveSnapshot: {
          investigationType: "problem",
          objective: "Test objective",
          geography: { country: "Canada", city: "Toronto" },
          targetIndustry: "Beauty",
        },
        steps: [
          {
            id: "step_discover",
            planId: "plan_123",
            order: 1,
            type: "discover_businesses",
            title: "Discover Businesses",
            objective: "Find salons",
            reason: "Build candidate list",
            configuration: { categories: ["beauty"] },
            dependencies: [],
            budget: { businessProviderQueries: 1, totalExternalRequests: 1, candidates: 20 },
            enabled: true,
            status: "planned",
          },
          {
            id: "step_synthesis",
            planId: "plan_123",
            order: 2,
            type: "synthesize_problem",
            title: "Synthesize Problem",
            objective: "Synthesize",
            reason: "Write report",
            configuration: {},
            dependencies: ["step_discover"],
            budget: { aiCalls: 1, totalExternalRequests: 1 },
            enabled: true,
            status: "planned",
          },
        ] as InvestigationPlanStep[],
      }),
      createSearchRun: async () => "run_test_123",
      attachSearchRun: vi.fn(),
      runDiscovery: vi.fn().mockResolvedValue(undefined),
      getSearchRun: async () => ({
        id: "run_test_123",
        status: searchRunStatus,
        providers: ["foursquare"],
        tavilyQueries: 0,
        exaQueries: 0,
        firecrawlEnriched: 0,
        discoveredCount: 5,
        candidatesReturned: 5,
        failures: [],
        durationMs: 1500,
        stages: { pagespeed: { count: 0 } },
        providerMetrics: {},
      }),
      synthesizeProblem: async () => { await new Promise((resolve) => setTimeout(resolve, 10)); return { synthesisId: "syn_test_123" }; },
      synthesizeMarket: async () => { await new Promise((resolve) => setTimeout(resolve, 10)); return { synthesisId: "syn_test_123" }; },
      linkEvidenceTrace: async () => 5,
    };
  };

  it("handles basic execution lifecycle and search run monitoring", async () => {
    const store = new MockExecutionStore();
    const deps = buildDeps(store, "running");
    const worker = new ExecutionWorker(deps);

    // Create execution
    const execId = await store.createQueuedExecution({
      investigationId: "inv_123",
      planId: "plan_123",
      plannedBudget: {
        businessProviderQueries: 8,
        webSearchQueries: 12,
        candidates: 40,
        firecrawlPages: 15,
        pagespeedAnalyses: 15,
        aiCalls: 3,
        totalExternalRequests: 60,
      },
      orderedPlanSteps: [
        { id: "step_discover", order: 1, type: "discover_businesses", title: "Discover Businesses", objective: "Find salons", reason: "Build candidate list", configuration: { categories: ["beauty"] }, dependencies: [], budget: { businessProviderQueries: 1, totalExternalRequests: 1, candidates: 20 }, enabled: true } as InvestigationPlanStepInput,
        { id: "step_synthesis", order: 2, type: "synthesize_problem", title: "Synthesize Problem", objective: "Synthesize", reason: "Write report", configuration: {}, dependencies: ["step_discover"], budget: { aiCalls: 1, totalExternalRequests: 1 }, enabled: true } as InvestigationPlanStepInput,
      ],
    });

    // 1st tick: launch first step, transition to running and waiting
    let exec = await worker.tick("inv_123", execId);
    expect(exec).not.toBeNull();
    expect(exec!.status).toBe("running");
    expect(exec!.steps[0].status).toBe("running");
    expect(exec!.steps[0].searchRunIds).toEqual(["run_test_123"]);

    // 2nd tick (Search Run still running): remain waiting
    exec = await worker.tick("inv_123", execId);
    expect(exec!.steps[0].status).toBe("running");

    // Simulate search run completed
    const completedDeps = buildDeps(store, "completed");
    const completedWorker = new ExecutionWorker(completedDeps);

    // 3rd tick: reconcile step 1, launch step 2 (synthesis)
    exec = await completedWorker.tick("inv_123", execId);
    expect(exec!.steps[0].status).toBe("completed");
    expect(exec!.steps[1].status).toBe("running");

    // Wait for synthesis async callback to finish
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 4th tick: synthesize completes, finalize execution
    exec = await completedWorker.tick("inv_123", execId);
    expect(exec!.steps[1].status).toBe("completed");
    expect(exec!.status).toBe("completed");
  });

  it("prevents double step launch via idempotent tick", async () => {
    const store = new MockExecutionStore();
    const deps = buildDeps(store, "running");
    const worker1 = new ExecutionWorker(deps);
    const worker2 = new ExecutionWorker(deps);

    const execId = await store.createQueuedExecution({
      investigationId: "inv_123",
      planId: "plan_123",
      plannedBudget: normalizeBudget({ businessProviderQueries: 8, totalExternalRequests: 60, candidates: 40 }),
      orderedPlanSteps: [{ id: "step_discover", order: 1, type: "discover_businesses", title: "Discover Businesses", objective: "Find salons", reason: "Build candidate list", configuration: { categories: ["beauty"] }, dependencies: [], budget: { businessProviderQueries: 1, totalExternalRequests: 1, candidates: 20 }, enabled: true } as InvestigationPlanStepInput],
    });

    // Worker 1 launches the step
    const exec1 = await worker1.tick("inv_123", execId);
    expect(exec1!.steps[0].status).toBe("running");
    expect(exec1!.steps[0].searchRunIds).toHaveLength(1);

    // Worker 2 ticks on the same execution — step is already running so it returns without re-launching
    const exec2 = await worker2.tick("inv_123", execId);
    // Step should still be running and not have a duplicate searchRunId
    expect(exec2!.steps[0].status).toBe("running");
    expect(exec2!.steps[0].searchRunIds).toHaveLength(1);
  });

  it("enforces budgets at step boundaries", async () => {
    const store = new MockExecutionStore();
    const deps = buildDeps(store);
    const worker = new ExecutionWorker(deps);

    const execId = await store.createQueuedExecution({
      investigationId: "inv_123",
      planId: "plan_123",
      plannedBudget: {
        businessProviderQueries: 0, // No budget!
        webSearchQueries: 0,
        candidates: 0,
        firecrawlPages: 0,
        pagespeedAnalyses: 0,
        aiCalls: 0,
        totalExternalRequests: 0,
      },
      orderedPlanSteps: [{ id: "step_discover", order: 1, type: "discover_businesses", title: "Discover Businesses", objective: "Find salons", reason: "Build candidate list", configuration: { categories: ["beauty"] }, dependencies: [], budget: { businessProviderQueries: 1, totalExternalRequests: 1, candidates: 20 }, enabled: true } as InvestigationPlanStepInput],
    });

    const exec = await worker.tick("inv_123", execId);
    expect(exec!.steps[0].status).toBe("blocked");
    expect(exec!.steps[0].errorCategory).toBe("budget_exhausted");
    expect(exec!.status).toBe("completed_with_errors"); // All non-skipped steps failed or blocked
  });

  it("supports cancellation requested flow", async () => {
    const store = new MockExecutionStore();
    const deps = buildDeps(store);
    const worker = new ExecutionWorker(deps);

    const execId = await store.createQueuedExecution({
      investigationId: "inv_123",
      planId: "plan_123",
      plannedBudget: {
        businessProviderQueries: 8,
        webSearchQueries: 12,
        candidates: 40,
        firecrawlPages: 15,
        pagespeedAnalyses: 15,
        aiCalls: 3,
        totalExternalRequests: 60,
      },
      orderedPlanSteps: [
        { id: "step_discover", order: 1, type: "discover_businesses", title: "Discover Businesses", objective: "Find salons", reason: "Build candidate list", configuration: { categories: ["beauty"] }, dependencies: [], budget: { businessProviderQueries: 1, totalExternalRequests: 1, candidates: 20 }, enabled: true } as InvestigationPlanStepInput,
        { id: "step_synthesis", order: 2, type: "synthesize_problem", title: "Synthesize Problem", objective: "Synthesize", reason: "Write report", configuration: {}, dependencies: ["step_discover"], budget: { aiCalls: 1, totalExternalRequests: 1 }, enabled: true } as InvestigationPlanStepInput,
      ],
    });

    // Launch step 1 (running)
    await worker.tick("inv_123", execId);

    // Request cancellation
    await store.patchExecution(execId, { cancellationRequested: 1 });

    // Tick again: remains running because step 1 is still in progress
    let exec = await worker.tick("inv_123", execId);
    expect(exec!.status).toBe("running");
    expect(exec!.cancellationRequested).toBe(1);

    // Reconcile step 1 to completion
    const completedDeps = buildDeps(store, "completed");
    const completedWorker = new ExecutionWorker(completedDeps);
    await completedWorker.tick("inv_123", execId);

    // Tick: cancellation should process now that step 1 is done, cancel step 2, finalize execution as cancelled
    exec = await completedWorker.tick("inv_123", execId);
    expect(exec!.steps[1].status).toBe("cancelled");
    expect(exec!.status).toBe("cancelled");
  });

  it("detects and recovers from process interruption", async () => {
    const store = new MockExecutionStore();
    const deps = buildDeps(store, "running");
    const worker = new ExecutionWorker(deps);

    const execId = await store.createQueuedExecution({
      investigationId: "inv_123",
      planId: "plan_123",
      plannedBudget: {
        businessProviderQueries: 8,
        webSearchQueries: 12,
        candidates: 40,
        firecrawlPages: 15,
        pagespeedAnalyses: 15,
        aiCalls: 3,
        totalExternalRequests: 60,
      },
      orderedPlanSteps: [{ id: "step_discover", order: 1, type: "discover_businesses", title: "Discover Businesses", objective: "Find salons", reason: "Build candidate list", configuration: { categories: ["beauty"] }, dependencies: [], budget: { businessProviderQueries: 1, totalExternalRequests: 1, candidates: 20 }, enabled: true } as InvestigationPlanStepInput],
    });

    // Launch step 1
    await worker.tick("inv_123", execId);

    // Simulate worker process restarting/re-claiming lock after long time
    // Force step's searchRunIds to be empty to trigger staleRunningStepIds check (which expects no search run)
    await store.patchStep(`step_${execId}_0`, { searchRunIds: [] });
    // Advance time beyond STEP_INTERRUPTION_MS
    deps.setNow(Date.now() + STEP_INTERRUPTION_MS + 1000);

    // Force release lock to allow next worker tick to claim it
    await store.patchExecution(execId, { status: "running", workerId: null, lockAcquiredAt: null });

    const exec = await worker.tick("inv_123", execId);
    expect(exec!.steps[0].status).toBe("failed");
    expect(exec!.steps[0].errorCategory).toBe("process_interruption");
    expect(exec!.status).toBe("completed_with_errors");
  });

  it("reaches completed_with_errors when a search run completes with provider errors", async () => {
    const store = new MockExecutionStore();
    const deps = buildDeps(store, "completed_with_errors");
    const worker = new ExecutionWorker(deps);

    const execId = await store.createQueuedExecution({
      investigationId: "inv_123",
      planId: "plan_123",
      plannedBudget: {
        businessProviderQueries: 8,
        webSearchQueries: 12,
        candidates: 40,
        firecrawlPages: 15,
        pagespeedAnalyses: 15,
        aiCalls: 3,
        totalExternalRequests: 60,
      },
      orderedPlanSteps: [
        { id: "step_discover", order: 1, type: "discover_businesses", title: "Discover Businesses", objective: "Find salons", reason: "Build candidate list", configuration: { categories: ["beauty"] }, dependencies: [], budget: { businessProviderQueries: 1, totalExternalRequests: 1, candidates: 20 }, enabled: true } as InvestigationPlanStepInput,
      ],
    });

    // 1st tick: launch step
    let exec = await worker.tick("inv_123", execId);
    expect(exec!.steps[0].status).toBe("running");

    // 2nd tick: reconcile search run completed_with_errors, finalize execution
    exec = await worker.tick("inv_123", execId);
    expect(exec!.steps[0].status).toBe("completed_with_errors");
    expect(exec!.steps[0].errorCategory).toBe("search_run_failure");
    expect(exec!.status).toBe("completed_with_errors");
  });

  it("reaches completed_with_errors when mixed search runs have provider errors", async () => {
    const store = new MockExecutionStore();
    let nowTime = Date.now();
    const deps = {
      store,
      now: () => new Date(nowTime),
      setNow: (time: number) => { nowTime = time; },
      logEvent: vi.fn(),
      getPlan: async (_investigationId: string, _planId: string): Promise<InvestigationPlan | null> => ({
        id: "plan_123",
        investigationId: "inv_123",
        version: 1,
        status: "approved",
        createdBy: "test",
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedAt: new Date(),
        executedAt: null,
        plannedBudget: {
          businessProviderQueries: 8,
          webSearchQueries: 12,
          candidates: 40,
          firecrawlPages: 15,
          pagespeedAnalyses: 15,
          aiCalls: 3,
          totalExternalRequests: 60,
        },
        estimatedProviders: ["foursquare", "yelp"],
        validationIssues: [],
        objectiveSnapshot: {
          investigationType: "problem",
          objective: "Test objective",
          geography: { country: "Canada", city: "Toronto" },
          targetIndustry: "Beauty",
        },
        steps: [
          {
            id: "step_discover",
            planId: "plan_123",
            order: 1,
            type: "discover_businesses",
            title: "Discover Businesses",
            objective: "Find salons",
            reason: "Build candidate list",
            configuration: { categories: ["beauty"] },
            dependencies: [],
            budget: { businessProviderQueries: 1, totalExternalRequests: 1, candidates: 20 },
            enabled: true,
            status: "planned",
          },
          {
            id: "step_discover_2",
            planId: "plan_123",
            order: 2,
            type: "discover_businesses",
            title: "Discover More",
            objective: "Find more salons",
            reason: "Expand candidate list",
            configuration: { categories: ["hair"] },
            dependencies: [],
            budget: { businessProviderQueries: 1, totalExternalRequests: 1, candidates: 20 },
            enabled: true,
            status: "planned",
          },
        ] as InvestigationPlanStep[],
      }),
      createSearchRun: async () => "run_test_123",
      attachSearchRun: vi.fn(),
      runDiscovery: vi.fn().mockResolvedValue(undefined),
      getSearchRun: async () => ({
        id: "run_test_123",
        status: "completed_with_errors",
        providers: ["foursquare"],
        tavilyQueries: 0,
        exaQueries: 0,
        firecrawlEnriched: 0,
        discoveredCount: 5,
        candidatesReturned: 5,
        failures: [],
        durationMs: 1500,
        stages: { pagespeed: { count: 0 } },
        providerMetrics: {},
      }),
      synthesizeProblem: async () => { await new Promise((resolve) => setTimeout(resolve, 10)); return { synthesisId: "syn_test_123" }; },
      synthesizeMarket: async () => { await new Promise((resolve) => setTimeout(resolve, 10)); return { synthesisId: "syn_test_123" }; },
      linkEvidenceTrace: async () => 5,
    };
    const worker = new ExecutionWorker(deps);

    const execId = await store.createQueuedExecution({
      investigationId: "inv_123",
      planId: "plan_123",
      plannedBudget: {
        businessProviderQueries: 8,
        webSearchQueries: 12,
        candidates: 40,
        firecrawlPages: 15,
        pagespeedAnalyses: 15,
        aiCalls: 3,
        totalExternalRequests: 60,
      },
      orderedPlanSteps: [
        { id: "step_discover", order: 1, type: "discover_businesses", title: "Discover Businesses", objective: "Find salons", reason: "Build candidate list", configuration: { categories: ["beauty"] }, dependencies: [], budget: { businessProviderQueries: 1, totalExternalRequests: 1, candidates: 20 }, enabled: true } as InvestigationPlanStepInput,
        { id: "step_discover_2", order: 2, type: "discover_businesses", title: "Discover More", objective: "Find more salons", reason: "Expand candidate list", configuration: { categories: ["hair"] }, dependencies: [], budget: { businessProviderQueries: 1, totalExternalRequests: 1, candidates: 20 }, enabled: true } as InvestigationPlanStepInput,
      ],
    });

    // 1st tick: launch step 1
    let exec = await worker.tick("inv_123", execId);
    expect(exec!.steps[0].status).toBe("running");

    // 2nd tick: reconcile step 1, launch step 2
    exec = await worker.tick("inv_123", execId);
    expect(exec!.steps[0].status).toBe("completed_with_errors");
    expect(exec!.steps[0].errorCategory).toBe("search_run_failure");
    expect(exec!.steps[1].status).toBe("running");

    // 3rd tick: reconcile step 2, finalize execution
    exec = await worker.tick("inv_123", execId);
    expect(exec!.steps[1].status).toBe("completed_with_errors");
    expect(exec!.steps[1].errorCategory).toBe("search_run_failure");
    expect(exec!.status).toBe("completed_with_errors");
  });
});
