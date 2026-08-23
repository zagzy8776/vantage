import { describe, expect, it } from "vitest";
import { buildPlanTemplate } from "./templates";
import { MAX_BUDGET, normalizeBudget } from "./budgets";
import { validatePlanSteps } from "./validator";
import type { InvestigationObjectiveSnapshot, InvestigationPlanStepInput } from "./types";

const objective: InvestigationObjectiveSnapshot = {
  investigationType: "problem",
  objective: "Investigate appointment no-shows in Toronto beauty businesses.",
  problemCategory: "appointment_no_shows",
  targetIndustry: "Beauty",
  geography: { country: "Canada", city: "Toronto" },
  criteria: { problemCategory: "appointment_no_shows" },
};

describe("investigation planning", () => {
  it("creates an objective-specific appointment plan without external calls", () => {
    const steps = buildPlanTemplate(objective);
    expect(steps.map((step) => step.type)).toEqual(["interpret_objective", "discover_businesses", "collect_evidence", "synthesize_problem"]);
    expect(steps[1].configuration).toMatchObject({ categories: ["beauty salons", "hair salons", "nail salons", "spas"] });
    expect(validatePlanSteps(steps)).toEqual([]);
  });

  it("rejects unknown providers, arbitrary URLs, and missing dependencies", () => {
    const steps: InvestigationPlanStepInput[] = [{ order: 1, type: "web_search", title: "Search", objective: "Search", reason: "Research", configuration: { providers: ["unknown"], urls: ["https://example.com"] }, dependencies: ["9"], budget: {}, enabled: true }];
    const issues = validatePlanSteps(steps);
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["invalid_dependency", "provider_not_allowed", "arbitrary_urls_not_allowed"]));
  });

  it("rejects circular dependencies and budgets above hard limits", () => {
    const steps: InvestigationPlanStepInput[] = [
      { order: 1, type: "discover_businesses", title: "A", objective: "A", reason: "A", configuration: {}, dependencies: ["2"], budget: { candidates: MAX_BUDGET.candidates + 1 }, enabled: true },
      { order: 2, type: "collect_evidence", title: "B", objective: "B", reason: "B", configuration: {}, dependencies: ["1"], budget: {}, enabled: true },
    ];
    const issues = validatePlanSteps(steps);
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["circular_dependency", "budget_exceeded"]));
  });

  it("normalizes negative and fractional budgets safely", () => {
    expect(normalizeBudget({ candidates: -2, aiCalls: 1.9 })).toMatchObject({ candidates: 0, aiCalls: 1 });
  });
});