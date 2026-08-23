import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { discoverBusinesses, createSearchRun } = vi.hoisted(() => ({
  discoverBusinesses: vi.fn(),
  createSearchRun: vi.fn(async () => "run_test"),
}));

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));
vi.mock("@/lib/discover/service", () => ({
  discoverBusinesses,
  failDiscoveryRun: vi.fn(),
}));
vi.mock("@/services/search-runs/service", () => ({ createSearchRun }));

import { POST } from "./route";

describe("POST /api/discover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(new NextRequest("http://localhost/api/discover", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });

  it("persists a queued Search Run and never fires discovery inline", async () => {
    const response = await POST(new NextRequest("http://localhost/api/discover", {
      method: "POST",
      body: JSON.stringify({ category: "Dental clinics", country: "CA", depth: "standard" }),
    }));

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.runId).toBe("run_test");
    expect(body.status).toBe("queued");
    expect(createSearchRun).toHaveBeenCalledTimes(1);
    // Durable handoff only - the sweep worker owns execution.
    expect(discoverBusinesses).not.toHaveBeenCalled();
  });
});
