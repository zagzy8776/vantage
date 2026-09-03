import { beforeEach, describe, expect, it, vi } from "vitest";
import { runBusinessDiscovery, searchResultRelevance } from "./router";
import { providerRegistry } from "./registry";

const query = { category: "Beauty salons", country: "Canada", city: "Toronto", region: "Ontario", limit: 5, depth: "quick" as const };
const result = (provider: "foursquare" | "yelp", status: "success" | "zero-results" | "failed") => ({ provider, status, results: status === "success" ? [{ externalId: provider, source: provider, name: provider, country: "Canada", city: "Toronto" }] : [], ...(status === "failed" ? { errorMessage: "failed" } : {}) });
const business = { externalId: "1", source: "foursquare" as const, name: "Royal Beauty Salon", country: "Canada", city: "Toronto" };

describe("business provider routing", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("does not call Yelp after explicit Foursquare failure", async () => {
    const foursquare = vi.spyOn(providerRegistry.foursquare, "search").mockResolvedValue(result("foursquare", "failed"));
    const yelp = vi.spyOn(providerRegistry.yelp, "search");
    const output = await runBusinessDiscovery(query, { mode: "primary", primary: "foursquare", requestedProvider: "foursquare", allowFallback: false });
    expect(foursquare).toHaveBeenCalledOnce(); expect(yelp).not.toHaveBeenCalled(); expect(output.queriedProviders).toEqual(["foursquare"]); expect(output.fallbackUsed).toBe(false);
  });

  it("does not call Yelp after explicit Foursquare zero results", async () => {
    vi.spyOn(providerRegistry.foursquare, "search").mockResolvedValue(result("foursquare", "zero-results"));
    const yelp = vi.spyOn(providerRegistry.yelp, "search");
    const output = await runBusinessDiscovery(query, { mode: "primary", primary: "foursquare", requestedProvider: "foursquare", allowFallback: false });
    expect(yelp).not.toHaveBeenCalled(); expect(output.queriedProviders).toEqual(["foursquare"]);
  });

  it("does not call Foursquare after explicit Yelp failure", async () => {
    vi.spyOn(providerRegistry.yelp, "search").mockResolvedValue(result("yelp", "failed"));
    const foursquare = vi.spyOn(providerRegistry.foursquare, "search");
    const output = await runBusinessDiscovery(query, { mode: "primary", primary: "yelp", requestedProvider: "yelp", allowFallback: false });
    expect(foursquare).not.toHaveBeenCalled(); expect(output.queriedProviders).toEqual(["yelp"]);
  });

  it("queries both providers in both mode", async () => {
    vi.spyOn(providerRegistry.foursquare, "search").mockResolvedValue(result("foursquare", "success"));
    vi.spyOn(providerRegistry.yelp, "search").mockResolvedValue(result("yelp", "success"));
    const output = await runBusinessDiscovery(query, { mode: "multi-source", requestedProvider: "both", allowFallback: false });
    expect(output.queriedProviders).toEqual(["foursquare", "yelp"]); expect(output.fallbackUsed).toBe(false);
  });

  it("uses controlled fallback only in best-available mode", async () => {
    vi.spyOn(providerRegistry.foursquare, "search").mockResolvedValue(result("foursquare", "zero-results"));
    const yelp = vi.spyOn(providerRegistry.yelp, "search").mockResolvedValue(result("yelp", "success"));
    const output = await runBusinessDiscovery(query, { mode: "fallback", primary: "foursquare", requestedProvider: "best-available", allowFallback: true });
    expect(yelp).toHaveBeenCalledOnce(); expect(output.queriedProviders).toEqual(["foursquare", "yelp"]); expect(output.fallbackUsed).toBe(true);
  });

  it("rejects a phone result that only shares one weak business-name token", () => {
    expect(searchResultRelevance({ title: "Royal Pharmacy", url: "https://example.com", snippet: "Toronto, Canada. Call 416-555-0100" }, business, "Toronto, Ontario, Canada")).toBe(0);
  });

  it("rejects an exact-name phone result from the wrong location", () => {
    expect(searchResultRelevance({ title: "Royal Beauty Salon", url: "https://example.com", snippet: "Vancouver, British Columbia, Canada. Call 604-555-0100" }, business, "Toronto, Ontario, Canada")).toBe(0);
  });

  it("accepts exact-name phone evidence when the requested location is present", () => {
    expect(searchResultRelevance({ title: "Royal Beauty Salon", url: "https://example.com", snippet: "Toronto, Ontario, Canada. Call 416-555-0100" }, business, "Toronto, Ontario, Canada")).toBeGreaterThanOrEqual(5);
  });
});
