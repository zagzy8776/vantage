import { describe, expect, it, vi } from "vitest";
import { MARKET_REGIONAL_PRIORITY, REGIONAL_SOURCE_REGISTRY, regionalSourceEnabled, sourceDefinition } from "./source-registry";

describe("regional job source registry", () => {
  it("keeps Nigeria sources ordered by market priority", () => {
    expect(MARKET_REGIONAL_PRIORITY.NG.slice(0, 4)).toEqual(["myjobmag", "jobberman", "hotnigerianjobs", "jobgurus"]);
  });

  it("registers MyJobMag as feed-first and web-opt-in", () => {
    const source = sourceDefinition("myjobmag");
    expect(source).toBeDefined();
    expect(source?.acquisition).toContain("public_feed");
    expect(source?.feedDiscoveryUrls).toContain("https://www.myjobmag.com/feeds/");
    expect(source?.requiresWebCrawlOptIn).toBe(true);
  });

  it("does not silently enable generic web crawling", () => {
    vi.stubEnv("VANTAGE_ENABLE_REGIONAL_WEB_CRAWL", "false");
    const source = sourceDefinition("jobberman");
    expect(source).toBeDefined();
    expect(regionalSourceEnabled(source!)).toBe(false);
  });

  it("enables explicitly opted-in web sources", () => {
    vi.stubEnv("VANTAGE_ENABLE_REGIONAL_WEB_CRAWL", "true");
    const source = sourceDefinition("jobberman");
    expect(regionalSourceEnabled(source!)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("keeps every configured source unique", () => {
    const ids = REGIONAL_SOURCE_REGISTRY.map((source) => source.provider);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
