import { describe, expect, it } from "vitest";
import { deriveOpportunities, OPPORTUNITY_TYPES } from "./tracking";

const at = (days: number) => new Date(Date.UTC(2026, 0, 1 + days));

describe("deriveOpportunities", () => {
  it("fires site performance recovery only for a sharp recent drop", () => {
    const result = deriveOpportunities(
      { performanceScore: 78, reviewCount: 10, starRating: 4.5, openStatus: true, category: "salon", observedAt: at(0) },
      { performanceScore: 52, reviewCount: 10, starRating: 4.5, openStatus: true, category: "salon", observedAt: at(14) },
    );
    expect(result).toContainEqual({ type: OPPORTUNITY_TYPES.SITE_PERFORMANCE_RECOVERY, evidenceSentence: "Performance score dropped from 78 to 52 over 14 days." });
  });

  it("does not fire site recovery for a slow decline", () => {
    const result = deriveOpportunities(
      { performanceScore: 78, observedAt: at(0) },
      { performanceScore: 52, observedAt: at(31) },
    );
    expect(result).toHaveLength(0);
  });

  it("requires both rating decay and review growth for reputation repair", () => {
    const result = deriveOpportunities(
      { reviewCount: 100, starRating: 4.8, observedAt: at(0) },
      { reviewCount: 155, starRating: 4.2, observedAt: at(14) },
    );
    expect(result[0]?.type).toBe(OPPORTUNITY_TYPES.REPUTATION_REPAIR);
  });

  it("fires expansion visibility only when a new category appears and the business is open", () => {
    const result = deriveOpportunities(
      { category: "salon", openStatus: true, observedAt: at(0) },
      { category: "salon, spa", openStatus: true, observedAt: at(14) },
    );
    expect(result[0]?.type).toBe(OPPORTUNITY_TYPES.EXPANSION_VISIBILITY);
  });

  it("does not infer expansion when open status is not established", () => {
    const result = deriveOpportunities(
      { category: "salon", openStatus: null, observedAt: at(0) },
      { category: "salon, spa", openStatus: null, observedAt: at(14) },
    );
    expect(result).toHaveLength(0);
  });
});
