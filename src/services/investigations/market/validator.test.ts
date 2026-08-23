import { describe, expect, it } from "vitest";
import { validateMarketSynthesis } from "./validator";

const context = { businessIds: new Set(["biz_1"]), evidenceIds: new Set(["ev_1"]), claimIds: new Set<string>(), allowedNumbers: new Set([1, 3, 10, 60]) };
const valid = { executiveSummary: "Among the businesses reviewed, booking evidence was observed in a subset of the sample.", marketPatterns: [{ title: "Booking signal", summary: "Among the businesses reviewed, booking evidence was observed for a subset of the sample.", type: "operational_signal", confidence: 60, businessIds: ["biz_1"], evidenceIds: ["ev_1"], claimType: "derived", claimIds: [], status: "supported", unknowns: [] }], opportunities: [{ title: "Booking workflow research", statement: "A booking workflow opportunity may warrant validation among the reviewed businesses.", confidence: 60, businessIds: ["biz_1"], evidenceIds: ["ev_1"], riskSummary: "Actual demand and operational impact are unknown.", status: "hypothesis" }], risks: [], unknowns: ["Actual appointment volume is unknown."], recommendedActions: [{ title: "Inspect booking flows", description: "Manually inspect the referenced booking flows.", priority: "medium", actionType: "manual_review" }] };

describe("market synthesis validator", () => {
  it("accepts valid sample-scoped patterns and hypotheses", () => expect(validateMarketSynthesis(valid, context).status).toBe("supported"));
  it("rejects invented business and evidence IDs", () => {
    const result = validateMarketSynthesis({ ...valid, marketPatterns: [{ ...valid.marketPatterns[0], businessIds: ["outside"], evidenceIds: ["missing"] }] }, context);
    expect(result.status).toBe("rejected");
  });
  it("rejects market-wide generalization", () => {
    const result = validateMarketSynthesis({ ...valid, marketPatterns: [{ ...valid.marketPatterns[0], summary: "Toronto salons all have online booking." }] }, context);
    expect(result.status).toBe("rejected");
  });
  it("never accepts a supported opportunity status", () => {
    const result = validateMarketSynthesis({ ...valid, opportunities: [{ ...valid.opportunities[0], status: "supported" }] }, context);
    expect(result.status).toBe("requires_review");
    expect(result.result.opportunities).toHaveLength(0);
  });

  it("rejects unsupported absence language in the executive summary", () => {
    const result = validateMarketSynthesis({ ...valid, executiveSummary: "None of the reviewed businesses have booking." }, context);
    expect(result.status).toBe("rejected");
    expect(result.issues.some((issue) => issue.type === "unsupported_absence")).toBe(true);
  });
});