import type { InvestigationType } from "@/services/investigations/types";

export type InvestigationPlanStatus = "draft" | "review" | "approved" | "executing" | "completed" | "completed_with_errors" | "failed" | "superseded";
export type InvestigationPlanStepStatus = "planned" | "ready" | "running" | "completed" | "completed_with_errors" | "skipped" | "failed" | "blocked" | "cancelled";
export type InvestigationPlanExecutionStatus = "created" | "queued" | "running" | "completed" | "completed_with_errors" | "failed" | "cancelled";
export type InvestigationPlanStepType = "interpret_objective" | "discover_businesses" | "expand_query" | "web_search" | "verify_business" | "research_website" | "analyze_website" | "collect_evidence" | "synthesize_problem" | "synthesize_market";

export type InvestigationObjectiveSnapshot = Record<string, unknown> & {
  investigationType: InvestigationType;
  objective: string;
  problemCategory?: string;
  serviceCategory?: string;
  targetIndustry?: string;
  geography: { country?: string; region?: string; city?: string };
  criteria?: Record<string, unknown> | null;
};

export type InvestigationPlanBudget = Record<string, number> & {
  businessProviderQueries: number;
  webSearchQueries: number;
  candidates: number;
  firecrawlPages: number;
  pagespeedAnalyses: number;
  aiCalls: number;
  totalExternalRequests: number;
};

export interface InvestigationPlanStepInput {
  id?: string;
  order: number;
  type: InvestigationPlanStepType;
  title: string;
  objective: string;
  reason: string;
  configuration: Record<string, unknown>;
  dependencies: string[];
  budget: Partial<InvestigationPlanBudget>;
  enabled: boolean;
}

export interface InvestigationPlanStep extends InvestigationPlanStepInput {
  id: string;
  planId: string;
  status: InvestigationPlanStepStatus;
}

export interface InvestigationPlan {
  id: string;
  investigationId: string;
  version: number;
  status: InvestigationPlanStatus;
  objectiveSnapshot: InvestigationObjectiveSnapshot;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  executedAt: Date | null;
  steps: InvestigationPlanStep[];
  plannedBudget: InvestigationPlanBudget;
  estimatedProviders: string[];
  validationIssues: PlanValidationIssue[];
}

export interface PlanValidationIssue { path: string; code: string; message: string; }

export interface InvestigationPlanExecution {
  id: string;
  investigationId: string;
  planId: string;
  status: InvestigationPlanExecutionStatus;
  plannedBudget: InvestigationPlanBudget;
  actualUsage: InvestigationPlanBudget;
  providerUsage?: InvestigationPlanExecutionProviderUsage[];
  failureReason: string | null;
  currentStepId?: string | null;
  cancellationRequested?: boolean;
  workerId?: string | null;
  lockAcquiredAt?: Date | null;
  startedAt: Date;
  completedAt: Date | null;
  steps: InvestigationPlanExecutionStep[];
}

export interface InvestigationPlanExecutionStep {
  id: string;
  executionId: string;
  planStepId: string;
  status: InvestigationPlanStepStatus;
  provider: string | null;
  searchRunIds: string[];
  outputIds: string[];
  actualUsage: Partial<InvestigationPlanBudget>;
  reason: string | null;
  errorCategory: string | null;
  safeMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export type InvestigationPlanExecutionProviderUsage = {
  provider: string;
  stage: string;
  requests: number;
  results: number;
  failures: number;
  durationMs: number | null;
};

export interface ExecutionStepStatusView {
  id: string;
  planStepId: string;
  order: number;
  title: string;
  type: string;
  status: InvestigationPlanStepStatus;
  searchRunIds: string[];
  outputIds: string[];
  reason: string | null;
  errorCategory: string | null;
}

export interface ExecutionBudgetView {
  planned: InvestigationPlanBudget;
  actual: InvestigationPlanBudget;
  remaining: InvestigationPlanBudget;
  exhausted: boolean;
}

export interface ExecutionStatusView {
  id: string;
  investigationId: string;
  planId: string;
  status: InvestigationPlanExecutionStatus;
  cancellationRequested: boolean;
  currentStep: ExecutionStepStatusView | null;
  counts: { total: number; completed: number; failed: number; blocked: number; running: number; cancelled: number; skipped: number; pending: number };
  steps: ExecutionStepStatusView[];
  budget: ExecutionBudgetView;
  providerUsage: InvestigationPlanExecutionProviderUsage[];
  searchRunIds: string[];
  errors: Array<{ stepId: string; title: string; errorCategory: string | null; message: string }>;
  failureReason: string | null;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
}

export interface PlanCreationResult { planId: string; version: number; status: InvestigationPlanStatus; validationIssues: PlanValidationIssue[]; }