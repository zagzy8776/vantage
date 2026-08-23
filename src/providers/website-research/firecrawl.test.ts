import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirecrawlWebsiteResearchProvider } from "./firecrawl";

describe("Firecrawl website research provider", () => {
  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "firecrawl-test";
    vi.unstubAllGlobals();
  });

  it("extracts bounded structured evidence", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { markdown: "# Example Studio\nBook an appointment. Shop products.", html: "<a href='/about'>About</a>" } }) })));
    const result = await new FirecrawlWebsiteResearchProvider().research({ businessId: "biz_1", url: "https://example.com", maxPages: 2 });
    expect(result.pagesFetched.length).toBeLessThanOrEqual(2);
    expect(result.evidence.some((item) => item.category === "booking")).toBe(true);
    expect(result.evidence.some((item) => item.category === "ecommerce")).toBe(true);
  });

  it("rejects private URLs and records provider failure", async () => {
    const invalid = await new FirecrawlWebsiteResearchProvider().research({ businessId: "biz_1", url: "http://127.0.0.1", maxPages: 5 });
    expect(invalid.errors[0]).toContain("permitted public URL");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ success: false, error: "down" }) })));
    const failed = await new FirecrawlWebsiteResearchProvider().research({ businessId: "biz_1", url: "https://example.com", maxPages: 1 });
    expect(failed.errors).toHaveLength(1);
  });

  it("records a safe request-schema diagnostic for Firecrawl v2 errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ success: false, error: "Unrecognized key in body -- please review the v2 API documentation for request body changes" }) })));
    const result = await new FirecrawlWebsiteResearchProvider().research({ businessId: "biz_1", url: "https://example.com", maxPages: 1 });
    expect(result.diagnostics?.[0]).toMatchObject({ httpStatus: 400, failureCategory: "request_schema", requestConstructed: true });
    expect(result.diagnostics?.[0].domain).toBe("example.com");
    expect(result.diagnostics?.[0].safeMessage).not.toContain("Bearer");
  });
});