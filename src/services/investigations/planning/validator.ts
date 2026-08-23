import { budgetIssues, MAX_BUDGET, normalizeBudget } from "./budgets";
import type { InvestigationPlanStepInput, PlanValidationIssue } from "./types";

const TYPES = new Set(["interpret_objective", "discover_businesses", "expand_query", "web_search", "verify_business", "research_website", "analyze_website", "collect_evidence", "synthesize_problem", "synthesize_market"]);
const PROVIDERS = new Set(["best-available", "foursquare", "yelp", "both", "tavily", "exa", "firecrawl", "pagespeed", "router"]);

export function validatePlanSteps(steps: InvestigationPlanStepInput[]): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];
  if (!steps.length) issues.push({ path: "steps", code: "no_executable_steps", message: "Plan must contain at least one step." });
  const ids = new Set(steps.map((step) => String(step.order)));
  const orders = steps.map((step) => step.order);
  if (new Set(orders).size !== orders.length || orders.some((order) => !Number.isInteger(order) || order < 1)) issues.push({ path: "steps.order", code: "invalid_order", message: "Step order must be unique positive integers." });
  for (const step of steps) {
    const path = `steps.${step.order}`;
    if (!TYPES.has(step.type)) issues.push({ path, code: "invalid_step_type", message: "Step type is not allowed." });
    if (!step.title.trim() || !step.objective.trim() || !step.reason.trim()) issues.push({ path, code: "missing_step_text", message: "Step title, objective, and reason are required." });
    for (const dependency of step.dependencies) if (!ids.has(dependency)) issues.push({ path: `${path}.dependencies`, code: "invalid_dependency", message: `Dependency ${dependency} does not reference a step.` });
    const budget = normalizeBudget(step.budget);
    for (const issue of budgetIssues(budget)) issues.push({ path: `${path}.${issue.path}`, code: "budget_exceeded", message: issue.message });
    const providers = Array.isArray(step.configuration.providers) ? step.configuration.providers : step.configuration.provider ? [step.configuration.provider] : [];
    for (const provider of providers) if (!PROVIDERS.has(String(provider))) issues.push({ path: `${path}.configuration.providers`, code: "provider_not_allowed", message: `Provider ${String(provider)} is not allowed.` });
    const urls = Array.isArray(step.configuration.urls) ? step.configuration.urls : [];
    if (urls.length) issues.push({ path: `${path}.configuration.urls`, code: "arbitrary_urls_not_allowed", message: "Plans cannot introduce arbitrary URLs." });
  }
  const graph = new Map(steps.map((step) => [String(step.order), step.dependencies]));
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (id: string): boolean => { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); for (const dependency of graph.get(id) ?? []) if (visit(dependency)) return true; visiting.delete(id); visited.add(id); return false; };
  for (const id of Array.from(graph.keys())) if (visit(id)) { issues.push({ path: "steps.dependencies", code: "circular_dependency", message: "Plan dependencies cannot contain cycles." }); break; }
  const total = steps.reduce((sum, step) => { const b = normalizeBudget(step.budget); return Object.fromEntries(Object.keys(MAX_BUDGET).map((key) => [key, Number(sum[key as keyof typeof sum] ?? 0) + b[key as keyof typeof b]])); }, {} as Record<string, number>);
  for (const issue of budgetIssues(normalizeBudget(total))) issues.push({ path: issue.path, code: "total_budget_exceeded", message: issue.message });
  return issues;
}