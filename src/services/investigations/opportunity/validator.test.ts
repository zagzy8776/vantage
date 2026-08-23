import { describe, expect, it } from "vitest";
import { validateOpportunitySynthesis } from "./validator";

const context = { businessIds: new Set(["biz_1"]), evidenceIds: new Set(["ev_1"]), claimIds: new Set<string>(), allowedNumbers: new Set([1, 60]) };
const valid = { executiveSummary: "Among the reviewed businesses, a workflow signal is present.", findings: [{ title: "Workflow signal", summary: "A workflow signal was observed.", confidence: 60, businessIds: ["biz_1"], evidenceIds: ["ev_1"], claimIds: [], unknowns: [], status: "supported" }], opportunities: [{ title: "Workflow hypothesis", statement: "A workflow opportunity may warrant validation.", confidence: 60, businessIds: ["biz_1"], evidenceIds: ["ev_1"], riskSummary: "Operational impact is unknown.", status: "hypothesis" }], unknowns: ["Actual loss is unknown."], recommendedActions: [{ title: "Interview owner", description: "Ask about workflow performance.", priority: "medium", actionType: "interview" }] };

describe("opportunity synthesis safety", () => {
  it("accepts evidence-backed hypotheses", () => expect(validateOpportunitySynthesis(valid, context).status).toBe("supported"));
  it("rejects unsupported financial loss claims", () => {
    const result = validateOpportunitySynthesis({ ...valid, opportunities: [{ ...valid.opportunities[0], statement: "The business loses 300000 monthly." }] }, context);
    expect(result.status).toBe("rejected");
    expect(result.issues.some((issue) => issue.type === "unsupported_absence_or_loss")).toBe(true);
  });

  it("allows the problem term no-show when it is not an absence claim", () => {
    const result = validateOpportunitySynthesis({ ...valid, opportunities: [{ ...valid.opportunities[0], statement: "A no-show management workflow may warrant validation." }] }, context);
    expect(result.issues.some((issue) => issue.type === "unsupported_absence_or_loss")).toBe(false);
  });

  it("allows explicit evidence-gap language", () => {
    const result = validateOpportunitySynthesis({ ...valid, executiveSummary: "There is no direct evidence of a no-show rate." }, context);
    expect(result.issues.some((issue) => issue.type === "unsupported_absence_or_loss")).toBe(false);
  });
});