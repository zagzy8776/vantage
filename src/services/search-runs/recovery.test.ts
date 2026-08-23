import { beforeEach, describe, expect, it, vi } from "vitest";

const { listRecoverableSearchRuns, claimSearchRunForRecovery, discoverBusinesses } = vi.hoisted(() => ({
  listRecoverableSearchRuns: vi.fn(),
  claimSearchRunForRecovery: vi.fn(),
  discoverBusinesses: vi.fn(),
}));

vi.mock("./service", () => ({
  listRecoverableSearchRuns,
  claimSearchRunForRecovery,
  discoveryQueryFromSearchRun: (row: { query: string; country: string; city: string | null; depth: "quick" | "standard" | "deep"; queryExpansion: number; evidenceEnrichment: number; searchSource: string | null }) => ({
    category: row.query,
    country: row.country,
    city: row.city ?? undefined,
    region: undefined,
    limit: 5,
    depth: row.depth,
    searchSource: row.searchSource ?? "best-available",
    queryExpansion: row.queryExpansion === 1,
    evidenceEnrichment: row.evidenceEnrichment === 1,
    webDiscoveryProvider: "best-available",
  }),
}));

vi.mock("@/lib/discover/service", () => ({ discoverBusinesses }));

import { recoverOrphanedSearchRuns } from "./recovery";

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run_1",
    query: "Dental clinics",
    country: "CA",
    city: "Toronto",
    depth: "standard" as const,
    queryExpansion: 1,
    evidenceEnrichment: 0,
    searchSource: null,
    status: "queued",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("search run recovery (cron sweep)", () => {
  it("recovers an orphaned queued run through the discovery engine", async () => {
    listRecoverableSearchRuns.mockResolvedValue([makeRun()]);
    claimSearchRunForRecovery.mockResolvedValue(true);
    discoverBusinesses.mockResolvedValue({ results: [] });

    const report = await recoverOrphanedSearchRuns({ workerId: "w1", maxRuns: 2 });

    expect(report.recovered).toEqual(["run_1"]);
    expect(report.failed).toEqual([]);
    expect(claimSearchRunForRecovery).toHaveBeenCalledWith("run_1", "w1", expect.any(Number));
    expect(discoverBusinesses).toHaveBeenCalledTimes(1);
    const [query, runId] = discoverBusinesses.mock.calls[0];
    expect(query.category).toBe("Dental clinics");
    expect(runId).toBe("run_1");
  });

  it("never recovers an already-terminal Search Run", async () => {
    listRecoverableSearchRuns.mockResolvedValue([makeRun({ status: "completed_with_errors" })]);

    const report = await recoverOrphanedSearchRuns({ workerId: "w1" });

    expect(report.skippedAlreadyTerminal).toEqual(["run_1"]);
    expect(claimSearchRunForRecovery).not.toHaveBeenCalled();
    expect(discoverBusinesses).not.toHaveBeenCalled();
  });

  it("skips a run whose lock is still held by a live worker", async () => {
    listRecoverableSearchRuns.mockResolvedValue([makeRun()]);
    claimSearchRunForRecovery.mockResolvedValue(false);

    const report = await recoverOrphanedSearchRuns({ workerId: "w1" });

    expect(report.recovered).toEqual([]);
    expect(discoverBusinesses).not.toHaveBeenCalled();
  });

  it("repeated sweeps do not re-process runs that reached a terminal state", async () => {
    // First sweep recovers the run.
    listRecoverableSearchRuns.mockResolvedValueOnce([makeRun()]);
    claimSearchRunForRecovery.mockResolvedValueOnce(true);
    discoverBusinesses.mockResolvedValue({ results: [] });
    await recoverOrphanedSearchRuns({ workerId: "w1" });
    expect(discoverBusinesses).toHaveBeenCalledTimes(1);

    // Second sweep: the run is now terminal so it is no longer a candidate.
    listRecoverableSearchRuns.mockResolvedValue([]);
    const second = await recoverOrphanedSearchRuns({ workerId: "w2" });
    expect(second.examined).toBe(0);
    expect(second.recovered).toEqual([]);
    expect(discoverBusinesses).toHaveBeenCalledTimes(1); // unchanged - no duplicates
  });

  it("records provider failures without throwing", async () => {
    listRecoverableSearchRuns.mockResolvedValue([makeRun()]);
    claimSearchRunForRecovery.mockResolvedValue(true);
    discoverBusinesses.mockRejectedValue(new Error("provider_error: Tavily unavailable"));

    const report = await recoverOrphanedSearchRuns({ workerId: "w1" });

    expect(report.failed).toEqual(["run_1"]);
    expect(report.errors[0]).toContain("Tavily");
  });

  it("bounds work per invocation", async () => {
    listRecoverableSearchRuns.mockResolvedValue([]);
    await recoverOrphanedSearchRuns({ workerId: "w1", maxRuns: 99 });
    expect(listRecoverableSearchRuns).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });
});
