import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));
import { POST } from "./route";

vi.mock("@/services/website-analysis/service", () => ({
  analyzeBusinesses: vi.fn(async () => ({ total: 1, successCount: 1, failureCount: 0, reusedCount: 0, results: [] })),
}));

describe("POST /api/websites/analyze/batch", () => {
  it("rejects invalid payloads", async () => {
    const response = await POST(new NextRequest("http://localhost/api/websites/analyze/batch", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });
});