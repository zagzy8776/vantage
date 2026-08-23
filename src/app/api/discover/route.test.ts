import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));
import { POST } from "./route";

vi.mock("@/lib/discover/service", () => ({
  discoverBusinesses: vi.fn(),
  failDiscoveryRun: vi.fn(),
}));

vi.mock("@/services/search-runs/service", () => ({ createSearchRun: vi.fn(async () => "run_test") }));

describe("POST /api/discover", () => {
  it("rejects invalid payloads", async () => {
    const response = await POST(new NextRequest("http://localhost/api/discover", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });
});