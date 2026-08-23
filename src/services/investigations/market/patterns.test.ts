import { describe, expect, it } from "vitest";
import { buildCandidateMarketPatterns } from "./patterns";
import type { MarketAggregates } from "./types";

const aggregates: MarketAggregates = {
  sampleSize: 10,
  businesses: { total: 10, verified: 2, likely: 3, uncertain: 4, rejected: 1 },
  distinctBusinessSignals: { websites: 4, booking: 3, ecommerce: 2, contact: 7, social: 0, pricing: 0, services: 3, pageSpeedAvailable: 4, pageSpeedSuccessful: 2, aiSupportedFindings: 1, aiReviewFindings: 0 },
  evidence: { total: 20, sourceDiversity: 3, bySource: { yelp: 10, website: 10 }, byCategory: { booking: 3 } },
  sampleLanguage: "This analysis describes the reviewed investigation sample of 10 businesses and should not be interpreted as a census of the entire market.",
};

describe("market candidate patterns", () => {
  it("uses distinct-business counts and explicit sample/absence-safe wording", () => {
    const patterns = buildCandidateMarketPatterns([{ id: "ev_1", businessId: "biz_1", category: "booking", sourceType: "website" }, { id: "ev_2", businessId: "biz_1", category: "booking", sourceType: "website" }, { id: "ev_3", businessId: "biz_2", category: "booking", sourceType: "website" }], aggregates);
    expect(patterns[0]?.summary).toContain("3 of the 10");
    expect(patterns[0]?.summary).toContain("not established");
    expect(patterns[0]?.affectedBusinessIds).toEqual(["biz_1", "biz_2"]);
  });
});