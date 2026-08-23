import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateTechnicalWebsiteHealth, normalizeWebsiteUrl, runPageSpeedAnalysis } from "./pagespeed";

describe("normalizeWebsiteUrl", () => {
  it("adds a scheme and normalizes host/query", () => {
    const result = normalizeWebsiteUrl("HTTPS://WWW.Example.com/?utm_source=google&ref=test#section");
    expect(result?.normalizedUrl).toBe("https://example.com/");
    expect(result?.hostname).toBe("example.com");
  });

  it("returns null for malformed urls", () => {
    expect(normalizeWebsiteUrl("http://%zz")).toBeNull();
  });
});

describe("calculateTechnicalWebsiteHealth", () => {
  it("derives good health from high scores", () => {
    expect(calculateTechnicalWebsiteHealth({ status: "success", performanceScore: 90, accessibilityScore: 92, bestPracticesScore: 88, seoScore: 95 }).websiteStatus).toBe("good");
  });

  it("marks failed network analysis unreachable", () => {
    expect(calculateTechnicalWebsiteHealth({ status: "failed", errorCode: "network-failure" }).websiteStatus).toBe("unreachable");
  });
});

describe("runPageSpeedAnalysis", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    process.env.PAGESPEED_API_KEY = "test-key";
  });

  it("normalizes a valid response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          lighthouseResult: {
            fetchTime: "2026-08-20T00:00:00.000Z",
            categories: {
              performance: { score: 0.41 },
              accessibility: { score: 0.58 },
              "best-practices": { score: 0.72 },
              seo: { score: 0.62 },
            },
          },
        }),
      }))
    );

    const result = await runPageSpeedAnalysis({ businessId: "biz_1", url: "https://example.com", strategy: "mobile" });
    expect(result.status).toBe("success");
    expect(result.performanceScore).toBe(41);
    expect(result.accessibilityScore).toBe(58);
  });

  it("returns failed results for malformed responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    );

    const result = await runPageSpeedAnalysis({ businessId: "biz_1", url: "https://example.com", strategy: "desktop" });
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("malformed-response");
  });

  it("preserves a Lighthouse runtime failure category without scores", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { code: "NO_FCP", message: "The page did not paint any content." } }) })));
    const result = await runPageSpeedAnalysis({ businessId: "biz_1", url: "https://example.com", strategy: "mobile" });
    expect(result.status).toBe("failed");
    expect(result.httpStatus).toBe(400);
    expect(result.errorCode).toBe("NO_FCP");
    expect(result.failureCategory).toBe("runtime_error");
    expect(result.performanceScore).toBeNull();
  });
});