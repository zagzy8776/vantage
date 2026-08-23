import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreate = vi.fn();
const mockList = vi.fn();
vi.mock("@/services/investigations/planning/planner", () => ({ createInvestigationPlan: (...args: unknown[]) => mockCreate(...args), getInvestigationPlans: (...args: unknown[]) => mockList(...args) }));

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@example.com", role: "analyst" }),
  requireRole: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@example.com", role: "analyst" }),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));

describe("investigation plans API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a reviewable plan without executing providers", async () => {
    mockCreate.mockResolvedValue({ planId: "plan_1", version: 1, status: "review", validationIssues: [] });
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/investigations/inv_1/plans", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith("inv_1", {});
  });

  it("lists persisted plan versions", async () => {
    mockList.mockResolvedValue([{ id: "plan_1", version: 1 }]);
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/investigations/inv_1/plans"), { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(200);
    expect((await response.json()).plans).toHaveLength(1);
  });
});