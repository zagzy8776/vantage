import type { InvestigationPlanBudget } from "./types";

export const MAX_BUDGET: InvestigationPlanBudget = {
  businessProviderQueries: 8,
  webSearchQueries: 12,
  candidates: 40,
  firecrawlPages: 15,
  pagespeedAnalyses: 15,
  aiCalls: 3,
  totalExternalRequests: 60,
};

export const ZERO_BUDGET: InvestigationPlanBudget = {
  businessProviderQueries: 0,
  webSearchQueries: 0,
  candidates: 0,
  firecrawlPages: 0,
  pagespeedAnalyses: 0,
  aiCalls: 0,
  totalExternalRequests: 0,
};

export function normalizeBudget(input: Partial<InvestigationPlanBudget> | undefined): InvestigationPlanBudget {
  return Object.fromEntries(Object.keys(MAX_BUDGET).map((key) => [key, Math.max(0, Math.floor(Number(input?.[key as keyof InvestigationPlanBudget] ?? 0))) ])) as unknown as InvestigationPlanBudget;
}

export function addBudget(left: Partial<InvestigationPlanBudget>, right: Partial<InvestigationPlanBudget>): InvestigationPlanBudget {
  return normalizeBudget(Object.fromEntries(Object.keys(MAX_BUDGET).map((key) => [key, Number(left[key as keyof InvestigationPlanBudget] ?? 0) + Number(right[key as keyof InvestigationPlanBudget] ?? 0)])) as Partial<InvestigationPlanBudget>);
}

export function budgetIssues(budget: InvestigationPlanBudget): Array<{ path: string; message: string }> {
  return Object.entries(MAX_BUDGET).flatMap(([key, maximum]) => budget[key as keyof InvestigationPlanBudget] > maximum ? [{ path: `budget.${key}`, message: `Budget exceeds system maximum of ${maximum}.` }] : []);
}