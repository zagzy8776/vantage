import { describe, expect, it } from "vitest";
import { aggregateEvidenceRows, selectSynthesisEvidence } from "./aggregates";

describe("investigation evidence aggregates", () => {
  it("counts source, category, confidence, freshness, and distinct businesses", () => {
    const result = aggregateEvidenceRows([
      { businessId: "biz_1", category: "booking", sourceType: "yelp", confidence: "high", observedAt: new Date("2026-08-20T00:00:00Z") },
      { businessId: "biz_1", category: "booking", sourceType: "website", confidence: "medium", observedAt: new Date("2026-08-01T00:00:00Z") },
      { businessId: "biz_2", category: "pricing", sourceType: "yelp", confidence: "low", observedAt: new Date("2026-01-01T00:00:00Z") },
    ], new Date("2026-08-22T00:00:00Z").getTime());
    expect(result.bySource).toEqual({ yelp: 2, website: 1 });
    expect(result.byCategory.booking).toBe(2);
    expect(result.byConfidence.low).toBe(1);
    expect(result.freshness.last30Days).toBe(1);
    expect(result.freshness.older).toBe(1);
    expect(result.signals.booking).toEqual({ evidenceCount: 2, businessCount: 1 });
  });

  it("keeps referenced evidence and bounds the synthesis context", () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({ id: `ev_${index}`, businessId: `biz_${index % 10}`, category: index % 2 ? "website" : "booking", sourceType: index % 3 ? "yelp" : "website", confidence: "high", observedAt: new Date("2026-08-22T00:00:00Z") }));
    const selected = selectSynthesisEvidence(rows, new Set(["ev_99"]), 20);
    expect(selected.length).toBe(20);
    expect(selected.some((item) => item.id === "ev_99")).toBe(true);
  });
});