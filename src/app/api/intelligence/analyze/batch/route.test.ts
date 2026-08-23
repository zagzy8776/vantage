import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));
import { POST } from "./route";

vi.mock("@/services/intelligence/lead-analysis", () => ({ analyzeLeads: vi.fn(async () => ({ total: 1, successCount: 1, failureCount: 0, results: [] })) }));

describe("POST /api/intelligence/analyze/batch", () => {
  it("rejects missing lead ids", async () => {
    const response = await POST(new NextRequest("http://localhost/api/intelligence/analyze/batch", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });

  it("returns partial-safe batch output", async () => {
    const response = await POST(new NextRequest("http://localhost/api/intelligence/analyze/batch", { method: "POST", body: JSON.stringify({ leadIds: ["lead_1"] }) }));
    expect(response.status).toBe(200);
    expect((await response.json()).batch.total).toBe(1);
  });
});