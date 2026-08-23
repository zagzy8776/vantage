import { beforeEach, describe, expect, it, vi } from "vitest";
import { FoursquareBusinessProvider } from "./foursquare";

describe("FoursquareBusinessProvider", () => {
  beforeEach(() => {
    process.env.FOURSQUARE_API_KEY = "test-key";
    vi.unstubAllGlobals();
  });

  it("normalizes a successful response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          {
            fsq_id: "abc",
            name: "Test Clinic",
            categories: [{ name: "Dental clinics" }],
            location: {
              country: "Canada",
              region: "Ontario",
              locality: "Toronto",
              neighborhood: ["Yorkville"],
              address: "123 St",
              formatted_address: "123 St, Toronto",
            },
            geocodes: { main: { latitude: 43.1, longitude: -79.1 } },
            contact: { tel: "+1 555-0000", website: "https://example.com" },
            rating: 4.7,
            stats: { total_ratings: 31 },
            price: 2,
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FoursquareBusinessProvider();
    const results = await provider.search({ category: "Dental clinics", country: "CA", city: "Toronto", limit: 10, depth: "standard" });

    expect(results.status).toBe("success");
    expect(results.results).toHaveLength(1);
    expect(results.results[0]?.externalId).toBe("abc");
    expect(results.results[0]?.city).toBe("Toronto");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://places-api.foursquare.com/places/search?query=Dental+clinics&limit=10&near=Toronto%2C+Ontario%2C+Canada",
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          Authorization: "Bearer test-key",
          "X-Places-Api-Version": "2025-06-17",
        },
      })
    );
  });
});