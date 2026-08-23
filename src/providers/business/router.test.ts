import { beforeEach, describe, expect, it, vi } from "vitest";
import { runBusinessDiscovery } from "./router";
import { providerRegistry } from "./registry";

const query = { category: "Beauty salons", country: "Canada", city: "Toronto", region: "Ontario", limit: 5, depth: "quick" as const };
const result = (provider: "foursquare" | "yelp", status: "success" | "zero-results" | "failed") => ({ provider, status, results: status === "success" ? [{ externalId: provider, source: provider, name: provider, country: "Canada", city: "Toronto" }] : [], ...(status === "failed" ? { errorMessage: "failed" } : {}) });

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
});