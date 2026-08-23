import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchEvidence } from "./router";
import { evidenceSearchRegistry } from "./registry";

describe("evidence search accounting", () => {
  beforeEach(() => {
    process.env.EXA_API_KEY = "test-exa";
    process.env.TAVILY_API_KEY = "test-tavily";
    vi.restoreAllMocks();
  });

  it("counts failed Exa attempts separately from usable results", async () => {
    vi.spyOn(evidenceSearchRegistry.exa, "search").mockResolvedValue({ provider: "exa", status: "failed", results: [], evidence: [], queryCount: 1, httpStatus: 400, failureCategory: "provider_error", errorMessage: "Exa search was unavailable." });
    const result = await searchEvidence({ businessName: "salons", category: "Beauty salons", country: "CA", limit: 5, query: "salons Toronto Canada" }, "exa");
    expect(result.queryCounts.exa).toBe(1);
    expect(result.successfulQueries.exa ?? 0).toBe(0);
    expect(result.failedQueries.exa).toBe(1);
    expect(result.resultCounts.exa ?? 0).toBe(0);
    expect(result.providerDiagnostics.exa?.[0]).toMatchObject({ httpStatus: 400, failureCategory: "provider_error" });
  });

  it("counts a thrown provider attempt as failed", async () => {
    vi.spyOn(evidenceSearchRegistry.exa, "search").mockRejectedValue(new Error("timeout"));
    const result = await searchEvidence({ businessName: "salons", category: "Beauty salons", country: "CA", limit: 5 }, "exa");
    expect(result.queryCounts.exa).toBe(1);
    expect(result.failedQueries.exa).toBe(1);
    expect(result.providerDiagnostics.exa?.[0].failureCategory).toBe("timeout");
  });
});