import { addBudget, normalizeBudget, ZERO_BUDGET } from "../budgets";
import type { ExecutionStatusView, ExecutionStepStatusView, InvestigationPlan, InvestigationPlanBudget, InvestigationPlanExecution, InvestigationPlanExecutionProviderUsage, InvestigationPlanExecutionStep, InvestigationPlanStep } from "../types";

export const TERMINAL_EXECUTION_STATUSES = ["completed", "completed_with_errors", "failed", "cancelled"] as const;
export const ACTIVE_EXECUTION_STATUSES = ["created", "queued", "running"] as const;
export type TerminalExecutionStatus = (typeof TERMINAL_EXECUTION_STATUSES)[number];

export function isActiveExecutionStatus(status: string) { return (ACTIVE_EXECUTION_STATUSES as readonly string[]).includes(status); }
export function isTerminalExecutionStatus(status: string) { return (TERMINAL_EXECUTION_STATUSES as readonly string[]).includes(status); }

export interface FailureClassification { category: "timeout" | "rate_limit" | "budget_exhausted" | "provider_error" | "process_interruption" | "dependency_block" | "search_run_failure" | "unknown"; message: string; }

export function classifyFailure(error: unknown): FailureClassification {
  const message = error instanceof Error ? error.message : "Plan step failed.";
  const lower = message.toLowerCase();
  if (lower.includes("process_interruption")) return { category: "process_interruption", message };
  if (lower.includes("dependency")) return { category: "dependency_block", message };
  if (lower.includes("search run")) return { category: "search_run_failure", message };
  if (lower.includes("budget")) return { category: "budget_exhausted", message };
  if (lower.includes("timeout") || lower.includes("aborted")) return { category: "timeout", message };
  if (lower.includes("rate") || lower.includes("429")) return { category: "rate_limit", message };
  if (lower.includes("provider")) return { category: "provider_error", message };
  return { category: "unknown", message };
}

export function remainingBudget(planned: InvestigationPlanBudget, actual: Partial<InvestigationPlanBudget>): InvestigationPlanBudget {
  const plannedNormalized = normalizeBudget(planned);
  return normalizeBudget(Object.fromEntries(Object.keys(ZERO_BUDGET).map((key) => [key, Math.max(0, plannedNormalized[key as keyof InvestigationPlanBudget] - Number(actual[key as keyof InvestigationPlanBudget] ?? 0))])));
}

export function firstExhaustedKey(planned: InvestigationPlanBudget, actual: Partial<InvestigationPlanBudget>, required: Partial<InvestigationPlanBudget>): string | null {
  const remaining = remainingBudget(planned, actual);
  for (const [key, amount] of Object.entries(required)) {
    if (Number(amount ?? 0) > remaining[key as keyof InvestigationPlanBudget]) return key;
  }
  return null;
}

function dependencyPolicy(step: InvestigationPlanStep): "block" | "continue" { return step.configuration.dependencyPolicy === "continue" ? "continue" : "block"; }

export type StepDecision =
  | { kind: "launch"; step: InvestigationPlanExecutionStep }
  | { kind: "skip"; step: InvestigationPlanExecutionStep; reason: string }
  | { kind: "block"; step: InvestigationPlanExecutionStep; reason: string };

const BAD_DEPENDENCY_STATUSES = ["failed", "blocked", "cancelled"];

export function resolveNextStep(plan: InvestigationPlan, execution: InvestigationPlanExecution): StepDecision | null {
  const byOrder = new Map(plan.steps.map((step) => [step.id, step]));
  const statusByPlanStepId = new Map<string, string>();
  execution.steps.forEach(step => statusByPlanStepId.set(step.planStepId, step.status));
  const ordered = [...execution.steps].sort((left, right) => (byOrder.get(left.planStepId)?.order ?? 0) - (byOrder.get(right.planStepId)?.order ?? 0));

  for (const record of ordered) {
    if (!["planned", "ready"].includes(record.status)) continue;

    const planStep = byOrder.get(record.planStepId);
    if (!planStep) continue;

    if (!planStep.enabled) return { kind: "skip", step: record, reason: "Disabled in approved plan." };

    // Check dependencies with proper type handling
    let dependenciesMet = true;
    for (const dependencyId of planStep.dependencies) {
      const dependencyStatus = statusByPlanStepId.get(dependencyId);
      if (!dependencyStatus) continue;

      if (dependencyStatus === "completed" || dependencyStatus === "skipped" || dependencyStatus === "completed_with_errors") continue;

      if (BAD_DEPENDENCY_STATUSES.includes(dependencyStatus as string)) {
        if (dependencyPolicy(planStep) === "block") {
          return {
            kind: "block",
            step: record,
            reason: `Dependency ${dependencyId} failed or was cancelled and requires all dependencies to be met`
          };
        } else {
          // Continue even if dependency failed
          dependenciesMet = false;
        }
      }
    }

    if (!dependenciesMet) {
      return { kind: "launch", step: record };
    }

    return { kind: "launch", step: record };
  }

  return null;
}

export function hasRunningSteps(execution: Pick<InvestigationPlanExecution, "steps">) { return execution.steps.some((step) => step.status === "running"); }

export function terminalExecutionStatus(execution: InvestigationPlanExecution, options?: { cancellationRequested?: boolean; catastrophicFailure?: boolean }): TerminalExecutionStatus {
  if (options?.catastrophicFailure) return "failed";

  const pending = execution.steps.filter((step) => ["planned", "ready"].includes(step.status)).length > 0 || execution.steps.some((step) => step.status === "running");
  if (pending) throw new Error("Execution still has runnable work; cannot finalize.");

  if (options?.cancellationRequested && !execution.steps.some((step) => step.status === "running")) return "cancelled";

  const executed = execution.steps.filter((step) => step.status !== "skipped");
  const hardFailed = executed.filter((step) => ["failed", "blocked", "completed_with_errors"].includes(step.status));
  const softFailed = executed.filter((step) => step.status === "completed" && step.errorCategory === "partial_provider_failure");

  // If any steps failed (hard or soft), mark as completed_with_errors
  // This indicates the investigation completed as far as possible despite provider failures
  if (hardFailed.length > 0 || softFailed.length > 0) {
    return "completed_with_errors";
  }

  // Otherwise complete successfully
  return "completed";
}

export function staleRunningStepIds(execution: InvestigationPlanExecution, now: Date, timeoutMs: number): string[] {
  if (execution.status !== "running") return [];
  return execution.steps.filter((step) => {
    if (step.status !== "running") return false;
    if (!step.startedAt) return true;
    if (step.searchRunIds.length > 0) return false;
    return now.getTime() - new Date(step.startedAt).getTime() > timeoutMs;
  }).map((step) => step.id);
}

function stepView(record: InvestigationPlanExecutionStep, planStep: InvestigationPlanStep | undefined): ExecutionStepStatusView {
  return { id: record.id, planStepId: record.planStepId, order: planStep?.order ?? 0, title: planStep?.title ?? "", type: planStep?.type ?? "", status: record.status, searchRunIds: record.searchRunIds ?? [], outputIds: record.outputIds ?? [], reason: record.reason, errorCategory: record.errorCategory };
}

export function buildExecutionStatusView(plan: InvestigationPlan, execution: InvestigationPlanExecution): ExecutionStatusView {
  const planById = new Map(plan.steps.map((step) => [step.id, step]));
  const ordered = [...execution.steps].sort((left, right) => (planById.get(left.planStepId)?.order ?? 0) - (planById.get(right.planStepId)?.order ?? 0));
  const views = ordered.map((record) => stepView(record, planById.get(record.planStepId)));
  const count = (...statuses: InvestigationPlanExecutionStep["status"][]) => ordered.filter((step) => statuses.includes(step.status)).length;
  const actual = normalizeBudget(execution.actualUsage);
  const remaining = remainingBudget(execution.plannedBudget, actual);
  const errors = views.filter((view) => ["failed", "blocked"].includes(view.status) || (view.status === "completed" && view.errorCategory === "partial_provider_failure")).map((view) => ({ stepId: view.id, title: view.title, errorCategory: view.errorCategory, message: view.reason ?? "" }));
  const providerUsage = (execution as unknown as { providerUsage?: unknown }).providerUsage as InvestigationPlanExecutionProviderUsage[] | undefined ?? [];
  const current = execution.currentStepId ? views.find((view) => view.id === execution.currentStepId) ?? null : null;
  const durationMs = execution.completedAt ? Math.max(0, new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) : null;
  return {
    id: execution.id,
    investigationId: execution.investigationId,
    planId: execution.planId,
    status: execution.status,
    cancellationRequested: Boolean(execution.cancellationRequested),
    currentStep: current,
    counts: { total: ordered.length, completed: count("completed"), failed: count("failed"), blocked: count("blocked"), running: count("running"), cancelled: count("cancelled"), skipped: count("skipped"), pending: count("planned", "ready") },
    steps: views,
    budget: { planned: normalizeBudget(execution.plannedBudget), actual, remaining, exhausted: actual.totalExternalRequests >= normalizeBudget(execution.plannedBudget).totalExternalRequests },
    providerUsage,
    searchRunIds: Array.from(new Set(views.flatMap((view) => view.searchRunIds))),
    errors,
    failureReason: execution.failureReason,
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
    durationMs,
  };
}

export function mergeProviderUsage(existing: InvestigationPlanExecutionProviderUsage[], additions: InvestigationPlanExecutionProviderUsage[]): InvestigationPlanExecutionProviderUsage[] {
  const merged = [...existing];
  for (const addition of additions) {
    const index = merged.findIndex((entry) => entry.provider === addition.provider && entry.stage === addition.stage);
    if (index === -1) merged.push(addition);
    else merged[index] = { ...merged[index], requests: merged[index].requests + addition.requests, results: merged[index].results + addition.results, failures: merged[index].failures + addition.failures, durationMs: (merged[index].durationMs ?? 0) + (addition.durationMs ?? 0) || null };
  }
  return merged;
}

export function usageDelta(reserved: Partial<InvestigationPlanBudget>, measured: Partial<InvestigationPlanBudget>): Partial<InvestigationPlanBudget> {
  return Object.fromEntries(
    Object.keys(ZERO_BUDGET).filter((key) =>
      Number(measured[key as keyof InvestigationPlanBudget] ?? 0) -
      Number(reserved[key as keyof InvestigationPlanBudget] ?? 0) !== 0
    ).map((key) =>
      [key, Math.max(0, Number(measured[key as keyof InvestigationPlanBudget] ?? 0) - Number(reserved[key as keyof InvestigationPlanBudget] ?? 0))]
    )
  );
}

export function sumUsage(records: Array<Partial<InvestigationPlanBudget>>): InvestigationPlanBudget {
  return records.reduce<InvestigationPlanBudget>((total, record) => addBudget(total, record), normalizeBudget({}));
}
