import { beforeEach, describe, expect, it, vi } from "vitest";
import { expandBusinessQuery } from "./query-expansion";

const routerMock = vi.hoisted(() => ({ generateWithFallback: vi.fn() }));
vi.mock("@/providers/ai/router", () => routerMock);

describe("query expansion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAX_CATEGORY_EXPANSIONS = "2";
  });

  it("limits AI expansion candidates and preserves geography", async () => {
    routerMock.generateWithFallback.mockResolvedValue({
      content: JSON.stringify({ intent: { normalizedIntent: "luxury wedding businesses", priority: "website" }, categoryCandidates: ["bridal boutique", "wedding planner", "event company", "venue"], synonyms: ["bridal shop", "wedding organizer"], relatedBusinessTypes: ["florist"], exclusions: ["private events"] }),
      metadata: { provider: "groq", fallbackUsed: false, attempts: 1 },
    });
    const result = await expandBusinessQuery({ businessType: "luxury wedding businesses", country: "Nigeria", city: "Lagos" });
    expect(result.categoryCandidates).toHaveLength(3);
    expect(result.intent.location).toBe("Lagos, Nigeria");
    expect(result.provider).toBe("groq");
  });

  it("falls back to deterministic bounded expansion", async () => {
    routerMock.generateWithFallback.mockRejectedValue(new Error("unavailable"));
    const result = await expandBusinessQuery({ businessType: "perfume store", country: "FR", city: "Paris" });
    expect(result.fallbackUsed).toBe(true);
    expect(result.categoryCandidates.length).toBeLessThanOrEqual(3);
    expect(result.categoryCandidates).toContain("perfume store");
  });
});