import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));

const mockUpdateActionStatus = vi.fn();

vi.mock("@/services/investigations/service", () => ({
  updateActionStatus: (...args: unknown[]) => mockUpdateActionStatus(...args),
}));

describe("PATCH /api/investigations/[id]/actions/[actionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["todo", "in_progress", "completed", "cancelled"] as const)("updates action status to %s", async (status) => {
    mockUpdateActionStatus.mockResolvedValue(true);
    const { PATCH } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1/actions/act_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "inv_1", actionId: "act_1" }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe(status);
    expect(mockUpdateActionStatus).toHaveBeenCalledWith("inv_1", "act_1", status);
  });

  it("rejects invalid status values", async () => {
    const { PATCH } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1/actions/act_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "inv_1", actionId: "act_1" }) });
    expect(response.status).toBe(400);
  });

  it("returns 404 when action does not exist", async () => {
    mockUpdateActionStatus.mockResolvedValue(false);
    const { PATCH } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1/actions/missing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "inv_1", actionId: "missing" }) });
    const data = await response.json();
    expect(response.status).toBe(404);
    expect(data.error).toBe("Action not found.");
  });

  it("returns 400 for invalid body", async () => {
    const { PATCH } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1/actions/act_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "inv_1", actionId: "act_1" }) });
    expect(response.status).toBe(400);
  });
});