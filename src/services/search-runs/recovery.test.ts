import { beforeEach, describe, expect, it, vi } from "vitest";

const { listRecoverableSearchRuns, claimSearchRunForRecovery, start } = vi.hoisted(() => ({
  listRecoverableSearchRuns: vi.fn(),
  claimSearchRunForRecovery: vi.fn(),
  start: vi.fn(),
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

vi.mock("workflow/api", () => ({ start }));
vi.mock("@/workflows/discovery-recovery", () => ({
  discoveryRecoveryWorkflow: vi.fn(),
}));

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
  start.mockResolvedValue({ runId: "wf_1" });
});

describe("search run recovery (cron sweep)", () => {
  it("claims an orphaned run and starts a durable workflow", async () => {
    listRecoverableSearchRuns.mockResolvedValue([makeRun()]);
    claimSearchRunForRecovery.mockResolvedValue(true);

    const report = await recoverOrphanedSearchRuns({ workerId: "w1", maxRuns: 2 });

    expect(report.recovered).toEqual(["run_1"]);
    expect(report.failed).toEqual([]);
    expect(claimSearchRunForRecovery).toHaveBeenCalledWith("run_1", "w1", expect.any(Number));
    expect(start).toHaveBeenCalledTimes(1);
    const [workflow, args] = start.mock.calls[0];
    expect(workflow).toBeDefined();
    expect(args[0].category).toBe("Dental clinics");
    expect(args[1]).toBe("run_1");
    expect(args[2]).toBe("w1");
  });

  it("never recovers an already-terminal Search Run", async () => {
    listRecoverableSearchRuns.mockResolvedValue([makeRun({ status: "completed_with_errors" })]);

    const report = await recoverOrphanedSearchRuns({ workerId: "w1" });

    expect(report.skippedAlreadyTerminal).toEqual(["run_1"]);
    expect(claimSearchRunForRecovery).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("skips a run whose lock is still held by a live worker", async () => {
    listRecoverableSearchRuns.mockResolvedValue([makeRun()]);
    claimSearchRunForRecovery.mockResolvedValue(false);

    const report = await recoverOrphanedSearchRuns({ workerId: "w1" });

    expect(report.recovered).toEqual([]);
    expect(start).not.toHaveBeenCalled();
  });

  it("repeated sweeps do not start duplicate workflows after the first claim", async () => {
    listRecoverableSearchRuns.mockResolvedValueOnce([makeRun()]);
    claimSearchRunForRecovery.mockResolvedValueOnce(true);
    await recoverOrphanedSearchRuns({ workerId: "w1" });
    expect(start).toHaveBeenCalledTimes(1);

    listRecoverableSearchRuns.mockResolvedValue([]);
    const second = await recoverOrphanedSearchRuns({ workerId: "w2" });
    expect(second.examined).toBe(0);
    expect(second.recovered).toEqual([]);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("records workflow scheduling failures without throwing", async () => {
    listRecoverableSearchRuns.mockResolvedValue([makeRun()]);
    claimSearchRunForRecovery.mockResolvedValue(true);
    start.mockRejectedValue(new Error("workflow unavailable"));

    const report = await recoverOrphanedSearchRuns({ workerId: "w1" });

    expect(report.failed).toEqual(["run_1"]);
    expect(report.errors[0]).toContain("workflow unavailable");
  });

  it("bounds work per invocation", async () => {
    listRecoverableSearchRuns.mockResolvedValue([]);
    await recoverOrphanedSearchRuns({ workerId: "w1", maxRuns: 99 });
    expect(listRecoverableSearchRuns).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });
});
