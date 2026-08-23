import { describe, expect, it } from "vitest";
import { IntelligenceValidationError, parseLeadIntelligenceJson, validateLeadIntelligence } from "./types";

const valid = {
  businessSummary: "A local dental clinic identified from provider evidence.",
  opportunityLevel: "low",
  opportunityScore: 22,
  strengths: ["Established review presence"],
  weaknesses: [],
  opportunities: [],
  risks: ["Website feature evidence is incomplete"],
  recommendedServices: [],
  evidence: [{ statement: "The provider record reports 42 reviews.", type: "fact", source: "business.reviewCount", evidenceIds: ["ev_1"], confidence: 100 }],
  unknowns: [],
  reasoning: "The available evidence does not support a strong project opportunity.",
  confidence: 68,
};

describe("lead intelligence validation", () => {
  it("accepts valid structured output", () => {
    expect(validateLeadIntelligence(valid).opportunityScore).toBe(22);
  });

  it("accepts fenced JSON but rejects malformed JSON", () => {
    expect(parseLeadIntelligenceJson(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``).confidence).toBe(68);
    expect(() => parseLeadIntelligenceJson("not json")).toThrow(IntelligenceValidationError);
  });

  it("rejects invalid ranges, missing fields, and evidence types", () => {
    expect(() => validateLeadIntelligence({ ...valid, opportunityScore: 101 })).toThrow("opportunityScore");
    expect(() => validateLeadIntelligence({ ...valid, confidence: -1 })).toThrow("confidence");
    expect(() => validateLeadIntelligence({ ...valid, evidence: [{ ...valid.evidence[0], type: "guess" }] })).toThrow("type");
    expect(() => validateLeadIntelligence({ ...valid, weaknesses: undefined })).toThrow("weaknesses");
  });
});