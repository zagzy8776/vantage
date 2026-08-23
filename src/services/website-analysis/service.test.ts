import { describe, expect, it, vi } from "vitest";
import { analyzeBusinesses, analyzeBusinessWebsite } from "./service";

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
          orderBy: async () => [],
        }),
      }),
    }),
    update: () => ({
      set: () => ({ where: async () => undefined }),
    }),
    insert: () => ({
      values: () => ({ onConflictDoUpdate: async () => undefined }),
    }),
  }),
}));

describe("website-analysis service", () => {
  it("rejects invalid business ids", async () => {
    await expect(analyzeBusinessWebsite("bad id" as string)).rejects.toThrow("Invalid business ID");
  });

  it("enforces batch limits", async () => {
    await expect(analyzeBusinesses(["a", "b", "c", "d", "e", "f"], { limit: 5 })).rejects.toThrow("Batch analysis is limited");
  });
});