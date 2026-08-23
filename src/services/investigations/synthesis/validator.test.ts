import { describe, expect, it } from "vitest";
import { validateInvestigationSynthesis } from "./validator";

const context = { businessIds: new Set(["biz_1"]), evidenceIds: new Set(["ev_1"]), claimIds: new Set(["claim_1"]) };

const valid = {
  executiveSummary: "Evidence indicates a limited sample signal; unknowns remain.",
  findings: [{ title: "Booking signal", summary: "Booking evidence appears in the reviewed sample.", findingType: "operational_signal", confidence: 70, businessIds: ["biz_1"], evidenceIds: ["ev_1"], claimIds: [], unknowns: ["Actual appointment volume is unknown."] }],
  opportunities: [{ title: "Booking workflow review", statement: "A booking workflow may warrant validation among the reviewed businesses.", confidence: 60, businessIds: ["biz_1"], evidenceIds: ["ev_1"], riskSummary: "Demand and operational impact are unknown.", status: "hypothesis" }],
  risks: [],
  unknowns: ["Actual appointment volume is unknown."],
  recommendedActions: [{ title: "Inspect booking workflow", description: "Manually inspect the referenced booking evidence.", priority: "medium", actionType: "manual_review" }],
};

describe("investigation synthesis validator", () => {
  it("accepts evidence-backed findings and hypothesis opportunities", () => {
    const result = validateInvestigationSynthesis(valid, context);
    expect(result.status).toBe("supported");
    expect(result.result.findings).toHaveLength(1);
    expect(result.result.opportunities[0]?.status).toBe("hypothesis");
  });

  it("rejects an evidence ID outside the supplied investigation evidence", () => {
    const result = validateInvestigationSynthesis({ ...valid, findings: [{ ...valid.findings[0], evidenceIds: ["ev_external"] }] }, context);
    expect(result.status).toBe("rejected");
    expect(result.issues.some((issue) => issue.type === "invalid_evidence_reference")).toBe(true);
  });

  it("rejects a business outside the investigation", () => {
    const result = validateInvestigationSynthesis({ ...valid, findings: [{ ...valid.findings[0], businessIds: ["biz_external"] }] }, context);
    expect(result.status).toBe("rejected");
  });

  it("never permits supported opportunities", () => {
    const result = validateInvestigationSynthesis({ ...valid, opportunities: [{ ...valid.opportunities[0], status: "supported" }] }, context);
    expect(result.status).toBe("requires_review");
    expect(result.result.opportunities).toHaveLength(0);
    expect(result.issues.some((issue) => issue.type === "unsafe_opportunity_status")).toBe(true);
  });

  it("requires review when a finding lacks references without inventing replacements", () => {
    const result = validateInvestigationSynthesis({ ...valid, findings: [{ ...valid.findings[0], businessIds: [], evidenceIds: [] }] }, context);
    expect(result.status).toBe("requires_review");
    expect(result.result.findings[0]?.evidenceIds).toEqual([]);
  });

  it("rejects an unsupported narrative count", () => {
    const result = validateInvestigationSynthesis({ ...valid, findings: [{ ...valid.findings[0], summary: "Booking evidence was found in 99 businesses." }] }, { ...context, allowedNumbers: new Set([0, 1, 2, 3, 10, 70]) });
    expect(result.status).toBe("rejected");
    expect(result.issues.some((issue) => issue.type === "unsupported_count")).toBe(true);
  });
});