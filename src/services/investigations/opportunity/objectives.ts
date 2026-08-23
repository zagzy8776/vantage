import { PROBLEM_CATEGORIES, type OpportunityInvestigationInput, type ProblemCategory } from "./types";

export const PROBLEM_LABELS: Record<ProblemCategory, string> = {
  missed_followups: "Missed follow-ups",
  appointment_no_shows: "Appointment no-shows",
  order_management: "Order management",
  inventory_discrepancy: "Inventory discrepancy",
  payment_collection: "Payment collection",
  invoice_followup: "Invoice follow-up",
  manual_reconciliation: "Manual reconciliation",
  customer_retention: "Customer retention",
  delivery_failure: "Delivery failure",
  staff_visibility: "Staff visibility",
  pricing_management: "Pricing management",
  supplier_management: "Supplier management",
  workflow_fragmentation: "Workflow fragmentation",
  reporting_visibility: "Reporting visibility",
};

export function isProblemCategory(value: unknown): value is ProblemCategory {
  return typeof value === "string" && PROBLEM_CATEGORIES.includes(value as ProblemCategory);
}

export function normalizeOpportunityCriteria(input: OpportunityInvestigationInput): Record<string, unknown> {
  return {
    objectiveMode: input.problemCategory ? "problem" : input.serviceCategory ? "service_opportunity" : "custom",
    ...(input.problemCategory ? { problemCategory: input.problemCategory } : {}),
    ...(input.serviceCategory ? { serviceCategory: input.serviceCategory } : {}),
    ...(input.industry ? { targetIndustry: input.industry } : {}),
    ...(input.geography ? { geography: input.geography } : {}),
    ...(input.criteria ?? {}),
  };
}

export function validateOpportunityInput(input: unknown): { ok: boolean; error?: string; data?: OpportunityInvestigationInput } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Opportunity investigation input must be an object." };
  const value = input as Record<string, unknown>;
  if (typeof value.objective !== "string" || !value.objective.trim()) return { ok: false, error: "Objective question is required." };
  if (value.problemCategory !== undefined && !isProblemCategory(value.problemCategory)) return { ok: false, error: "Invalid problem category." };
  if (value.serviceCategory !== undefined && (typeof value.serviceCategory !== "string" || !value.serviceCategory.trim())) return { ok: false, error: "Service category must be a non-empty string." };
  return { ok: true, data: { objective: value.objective.trim(), problemCategory: value.problemCategory as ProblemCategory | undefined, serviceCategory: typeof value.serviceCategory === "string" ? value.serviceCategory.trim() : undefined, industry: typeof value.industry === "string" ? value.industry.trim() : undefined, geography: value.geography && typeof value.geography === "object" ? value.geography as OpportunityInvestigationInput["geography"] : undefined, criteria: value.criteria && typeof value.criteria === "object" ? value.criteria as Record<string, unknown> : undefined } };
}