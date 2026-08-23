import { describe, expect, it } from "vitest";
import { validateIntelligenceClaims } from "./claim-validator";
import type { LeadIntelligence, ValidationEvidence } from "./types";

const base = (statement: string, type: "fact" | "derived" | "inference", evidenceIds: string[] = []): LeadIntelligence => ({
  businessSummary: "A business under review.",
  opportunityLevel: "low",
  opportunityScore: 20,
  strengths: [],
  weaknesses: [],
  opportunities: [],
  risks: [],
  recommendedServices: [],
  evidence: [{ statement, type, source: "test", evidenceIds, confidence: 80 }],
  unknowns: [],
  reasoning: "The conclusion is limited to supplied evidence.",
  confidence: 80,
});

const evidence = (id: string, statement: string, businessId = "biz_1", sourceType = "pagespeed"): ValidationEvidence => ({ id, businessId, statement, sourceType });

describe("deterministic intelligence claim validation", () => {
  it("requires evidence IDs for facts", () => {
    const result = validateIntelligenceClaims(base("The website is reachable.", "fact"), [evidence("ev_1", "PageSpeed analysis completed successfully for the submitted URL.")], "biz_1");
    expect(result.status).toBe("requires_review");
    expect(result.issues[0]?.type).toBe("missing_evidence_reference");
  });

  it("rejects nonexistent and cross-business evidence references", () => {
    const invalid = validateIntelligenceClaims(base("The business is in Toronto.", "fact", ["missing"]), [evidence("ev_other", "The business is in Toronto.", "biz_2")], "biz_1");
    expect(invalid.status).toBe("rejected");
    expect(invalid.issues.map((issue) => issue.type)).toContain("invalid_evidence_reference");

    const crossBusiness = validateIntelligenceClaims(base("The business is in Toronto.", "fact", ["ev_other"]), [evidence("ev_other", "The business is in Toronto.", "biz_2")], "biz_1");
    expect(crossBusiness.status).toBe("rejected");
    expect(crossBusiness.issues.map((issue) => issue.type)).toContain("cross_business_evidence");
  });

  it("flags the Nova Era contradiction", () => {
    const result = validateIntelligenceClaims(base("The website is unreachable.", "fact", ["ev_success"]), [evidence("ev_success", "PageSpeed analysis completed successfully for the submitted URL.")], "biz_1");
    expect(result.status).toBe("requires_review");
    expect(result.issues.map((issue) => issue.type)).toContain("contradiction");
  });

  it("does not infer unreachable from a low PageSpeed score", () => {
    const result = validateIntelligenceClaims(base("The website is unreachable.", "fact", ["ev_score"]), [evidence("ev_score", "PageSpeed reported performance score for the official website.", "biz_1", "pagespeed")], "biz_1");
    expect(result.status).toBe("requires_review");
    expect(result.issues.map((issue) => issue.type)).toContain("contradiction");
  });

  it("allows unknown statements and direct phone-only booking evidence", () => {
    const unknownIntelligence = base("No claim.", "inference", ["ev_identity"]);
    unknownIntelligence.evidence = [];
    unknownIntelligence.unknowns = ["Online booking availability is unknown."];
    const unknown = validateIntelligenceClaims(unknownIntelligence, [], "biz_1");
    expect(unknown.status).toBe("supported");
    expect(unknown.issues).toHaveLength(0);
    const direct = validateIntelligenceClaims(base("Appointments are accepted only by phone.", "fact", ["ev_phone"]), [evidence("ev_phone", "Public page states appointments are accepted only by phone.", "biz_1", "public_page")], "biz_1");
    expect(direct.status).toBe("supported");
  });
});