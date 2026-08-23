import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));
import { POST } from "./route";

vi.mock("@/services/intelligence/lead-analysis", () => ({ analyzeLead: vi.fn(async () => ({ leadId: "lead_1", opportunityScore: 40 })) }));

describe("POST /api/intelligence/analyze", () => {
  it("rejects missing lead ids", async () => {
    const response = await POST(new NextRequest("http://localhost/api/intelligence/analyze", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });

  it("returns normalized intelligence", async () => {
    const response = await POST(new NextRequest("http://localhost/api/intelligence/analyze", { method: "POST", body: JSON.stringify({ leadId: "lead_1" }) }));
    expect(response.status).toBe(200);
    expect((await response.json()).intelligence.leadId).toBe("lead_1");
  });
});