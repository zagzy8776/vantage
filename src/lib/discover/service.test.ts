import { describe, expect, it, vi } from "vitest";
import { discoverBusinesses } from "./service";

vi.mock("@/providers/business/foursquare", () => ({
  foursquareBusinessProvider: {
    search: vi.fn(async () => ({
      provider: "foursquare",
      status: "success",
      results: [
        { externalId: "abc", source: "foursquare", name: "Test Clinic", country: "Canada", city: "Toronto" },
      ],
    })),
  },
}));

vi.mock("@/providers/business/yelp", () => ({
  yelpBusinessProvider: {
    search: vi.fn(async () => ({ provider: "yelp", status: "zero-results", results: [] })),
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: async () => undefined,
      }),
    }),
  }),
}));

describe("discoverBusinesses", () => {
  it("returns discovered businesses and stored ids", async () => {
    const result = await discoverBusinesses({ category: "Dental clinics", country: "CA", limit: 10, depth: "standard" });
    expect(result.results).toHaveLength(1);
    expect(result.storedIds[0]).toContain("lead_foursquare_");
    expect(result.resultSources[0]).toContain("foursquare");
  });
});