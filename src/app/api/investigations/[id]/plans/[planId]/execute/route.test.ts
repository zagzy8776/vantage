import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));

const mockExecute = vi.fn();
vi.mock("@/services/investigations/planning/executor", () => ({ executeInvestigationPlan: (...args: unknown[]) => mockExecute(...args) }));

describe("investigation plan execution API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unapproved plan", async () => {
    mockExecute.mockRejectedValue(new Error("Only approved plans can be executed."));
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: "inv_1", planId: "plan_1" }) });
    expect(response.status).toBe(409);
  });

  it("returns a queued execution result", async () => {
    mockExecute.mockResolvedValue({ executionId: "execution_1", status: "queued" });
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: "inv_1", planId: "plan_1" }) });
    expect(response.status).toBe(202);
    expect(mockExecute).toHaveBeenCalledWith("inv_1", "plan_1");
  });
});