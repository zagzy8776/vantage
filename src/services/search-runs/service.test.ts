import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({ mode: "success" as "success" | "missing" | "zero" | "update-error" | "read-error", updateCalls: 0, selectCalls: 0, terminalStatus: null as string | null }));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            dbState.selectCalls += 1;
            if (dbState.mode === "read-error" && dbState.selectCalls > 1) throw new Error("verification read failed");
            if (dbState.mode === "missing") return [];
            return [{ startedAt: new Date("2026-01-01T00:00:00Z"), status: dbState.terminalStatus ?? "running", completedAt: dbState.terminalStatus ? new Date() : null, stages: {}, failures: [] }];
          },
        }),
      }),
    }),
    update: () => ({
      set: (patch: { status?: string }) => ({
        where: () => ({
          returning: async () => {
          dbState.updateCalls += 1;
          if (dbState.mode === "update-error") throw new Error("update failed");
          if (dbState.mode === "zero") return [];
          dbState.terminalStatus = patch.status ?? null;
          return [{ id: "run_1" }];
          },
        }),
      }),
    }),
  }),
}));

import { completeSearchRun } from "./service";

describe("search run finalization", () => {
  beforeEach(() => {
    dbState.mode = "success";
    dbState.updateCalls = 0;
    dbState.selectCalls = 0;
    dbState.terminalStatus = null;
  });

  it.each(["completed", "completed_with_errors", "failed"] as const)("persists and verifies %s", async (status) => {
    const result = await completeSearchRun("run_1", status);
    expect(result).toMatchObject({ attempted: true, persisted: true, verified: true });
  });

  it("distinguishes a missing run", async () => {
    dbState.mode = "missing";
    await expect(completeSearchRun("missing", "failed")).resolves.toMatchObject({ attempted: false, persisted: false, verified: false, reason: "run_not_found" });
  });

  it("distinguishes an update affecting zero rows", async () => {
    dbState.mode = "zero";
    await expect(completeSearchRun("run_1", "failed")).resolves.toMatchObject({ attempted: true, persisted: false, verified: false, reason: "update_zero_rows" });
  });

  it("distinguishes an update exception", async () => {
    dbState.mode = "update-error";
    await expect(completeSearchRun("run_1", "failed")).resolves.toMatchObject({ attempted: true, persisted: false, verified: false, reason: "update_failed" });
  });

  it("distinguishes a verification read-back failure", async () => {
    dbState.mode = "read-error";
    await expect(completeSearchRun("run_1", "failed")).resolves.toMatchObject({ attempted: true, persisted: true, verified: false, reason: "verification_failed" });
  });
});