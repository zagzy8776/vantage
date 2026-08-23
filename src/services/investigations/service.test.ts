import { describe, expect, it } from "vitest";

import { validateCreateInvestigationInput, validateEvidenceIds, isValidInvestigationType } from "./validation";

describe("investigation validation", () => {
  it("validates a complete input", () => {
    const result = validateCreateInvestigationInput({
      title: "Test Investigation",
      objective: "Test objective",
      investigationType: "industry",
      searchRunId: "run_123",
    });
    expect(result.ok).toBe(true);
    expect(result.data?.title).toBe("Test Investigation");
  });

  it("rejects missing title", () => {
    const result = validateCreateInvestigationInput({ objective: "Test", investigationType: "industry", searchRunId: "run_1" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Title");
  });

  it("rejects missing objective", () => {
    const result = validateCreateInvestigationInput({ title: "Test", investigationType: "industry", searchRunId: "run_1" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Objective");
  });

  it("rejects invalid investigation type", () => {
    const result = validateCreateInvestigationInput({ title: "Test", objective: "Test", investigationType: "invalid", searchRunId: "run_1" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("investigation type");
  });

  it("accepts optional search run ID", () => {
    const result = validateCreateInvestigationInput({ title: "Test", objective: "Test", investigationType: "industry" });
    expect(result.ok).toBe(true);
    expect(result.data?.searchRunId).toBeUndefined();
  });

  it("rejects invalid search run ID", () => {
    const result = validateCreateInvestigationInput({ title: "Test", objective: "Test", investigationType: "industry", searchRunId: "" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("search run ID");
  });

  it("validates evidence IDs", () => {
    expect(validateEvidenceIds(["ev_1", "ev_2"])).toBe(true);
    expect(validateEvidenceIds([])).toBe(true);
    expect(validateEvidenceIds(["" as string])).toBe(false);
    expect(validateEvidenceIds(["ev_1", ""])).toBe(false);
  });

  it("validates investigation types", () => {
    expect(isValidInvestigationType("company")).toBe(true);
    expect(isValidInvestigationType("industry")).toBe(true);
    expect(isValidInvestigationType("market")).toBe(true);
    expect(isValidInvestigationType("problem")).toBe(true);
    expect(isValidInvestigationType("service_opportunity")).toBe(true);
    expect(isValidInvestigationType("invalid")).toBe(false);
  });
});