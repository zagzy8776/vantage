import { beforeEach, describe, expect, it, vi } from "vitest";
import { TavilyEvidenceSearchProvider } from "./tavily";
import { ExaEvidenceSearchProvider } from "./exa";
import { searchEvidence } from "./router";
import { evidenceSearchRegistry } from "./registry";

describe("external evidence search providers", () => {
  beforeEach(() => {
    process.env.TAVILY_API_KEY = "tavily-test";
    process.env.EXA_API_KEY = "exa-test";
    vi.unstubAllGlobals();
  });

  it("normalizes Tavily results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ results: [{ title: "Example Bridal", url: "https://example.com", content: "Bridal services in Lagos" }] }) })));
    const result = await new TavilyEvidenceSearchProvider().search({ businessName: "bridal", country: "NG", limit: 3 });
    expect(result.status).toBe("success");
    expect(result.results[0]?.title).toBe("Example Bridal");
    expect(result.evidence).toHaveLength(0);
  });

  it("normalizes Exa results and handles malformed responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ results: [{ title: "Example Studio", url: "https://studio.example", highlights: ["Beauty studio"] }] }) })));
    const result = await new ExaEvidenceSearchProvider().search({ businessName: "beauty", country: "NG", limit: 3 });
    expect(result.status).toBe("success");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    expect((await new ExaEvidenceSearchProvider().search({ businessName: "beauty", limit: 3 })).status).toBe("malformed-response");
  });

  it("routes best-available and both modes", async () => {
    vi.spyOn(evidenceSearchRegistry.tavily, "search").mockResolvedValue({ provider: "tavily", status: "failed", results: [], evidence: [], queryCount: 1 });
    vi.spyOn(evidenceSearchRegistry.exa, "search").mockResolvedValue({ provider: "exa", status: "success", results: [], evidence: [], queryCount: 1 });
    const fallback = await searchEvidence({ businessName: "x", limit: 2 }, "best-available");
    expect(fallback.providers).toEqual(["exa"]);
    vi.spyOn(evidenceSearchRegistry.tavily, "search").mockResolvedValue({ provider: "tavily", status: "success", results: [], evidence: [], queryCount: 1 });
    const both = await searchEvidence({ businessName: "x", limit: 2 }, "both");
    expect(both.results).toHaveLength(2);
  });
});