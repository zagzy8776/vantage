import { describe, expect, it } from "vitest";
import { evidenceFreshness, findEvidenceConflicts } from "./conflicts";
import type { EvidenceItem } from "./types";

const item = (sourceType: EvidenceItem["sourceType"], value: string): EvidenceItem => ({ businessId: "biz_1", category: "opening_hours", statement: `Hours ${value}`, value, sourceType, confidence: "high", observedAt: "2026-08-20T00:00:00.000Z" });

describe("evidence conflicts and freshness", () => {
  it("preserves conflicting facts for review", () => {
    const conflicts = findEvidenceConflicts([item("foursquare", "open until 9 PM"), item("yelp", "open until 7 PM")]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.status).toBe("requires-review");
  });

  it("classifies configurable freshness", () => {
    expect(evidenceFreshness("2026-08-20T00:00:00.000Z", new Date("2026-08-21T00:00:00.000Z"))).toBe("fresh");
    expect(evidenceFreshness("2026-06-01T00:00:00.000Z", new Date("2026-08-21T00:00:00.000Z"))).toBe("aging");
    expect(evidenceFreshness("2025-01-01T00:00:00.000Z", new Date("2026-08-21T00:00:00.000Z"))).toBe("stale");
  });
});