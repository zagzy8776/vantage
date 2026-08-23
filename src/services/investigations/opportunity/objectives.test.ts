import { describe, expect, it } from "vitest";
import { isProblemCategory, normalizeOpportunityCriteria, validateOpportunityInput } from "./objectives";

describe("opportunity investigation objectives", () => {
  it("accepts extensible problem categories without treating them as facts", () => {
    expect(isProblemCategory("appointment_no_shows")).toBe(true);
    expect(normalizeOpportunityCriteria({ objective: "Where might appointments leak?", problemCategory: "appointment_no_shows", industry: "Beauty", geography: { city: "Toronto", country: "Canada" } })).toMatchObject({ objectiveMode: "problem", problemCategory: "appointment_no_shows" });
  });
  it("rejects unknown categories", () => expect(validateOpportunityInput({ objective: "Investigate", problemCategory: "made_up" }).ok).toBe(false));
  it("requires an objective question", () => expect(validateOpportunityInput({ problemCategory: "appointment_no_shows" }).error).toContain("Objective"));
});