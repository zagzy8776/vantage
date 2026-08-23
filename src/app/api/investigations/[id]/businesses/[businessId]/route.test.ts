import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));

const mockUpdateRole = vi.fn();
const mockRemove = vi.fn();

vi.mock("@/services/investigations/service", () => ({
  updateInvestigationBusinessRole: (...args: unknown[]) => mockUpdateRole(...args),
  removeInvestigationBusiness: (...args: unknown[]) => mockRemove(...args),
}));

describe("investigation business relationship review", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["primary", "comparison", "candidate", "excluded"])("updates a business relationship to %s", async (role) => {
    mockUpdateRole.mockResolvedValue(true);
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/investigations/inv_1/businesses/biz_1", { method: "PATCH", body: JSON.stringify({ role }) }),
      { params: Promise.resolve({ id: "inv_1", businessId: "biz_1" }) },
    );
    expect(response.status).toBe(200);
    expect(mockUpdateRole).toHaveBeenCalledWith("inv_1", "biz_1", role);
  });

  it("rejects invalid roles", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/investigations/inv_1/businesses/biz_1", { method: "PATCH", body: JSON.stringify({ role: "removed" }) }),
      { params: Promise.resolve({ id: "inv_1", businessId: "biz_1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("removes only the investigation relationship", async () => {
    mockRemove.mockResolvedValue(true);
    const { DELETE } = await import("./route");
    const response = await DELETE(new NextRequest("http://localhost/api/investigations/inv_1/businesses/biz_1", { method: "DELETE" }), { params: Promise.resolve({ id: "inv_1", businessId: "biz_1" }) });
    expect(response.status).toBe(200);
    expect(mockRemove).toHaveBeenCalledWith("inv_1", "biz_1");
  });

  it("returns not found when the relationship is missing", async () => {
    mockRemove.mockResolvedValue(false);
    const { DELETE } = await import("./route");
    const response = await DELETE(new NextRequest("http://localhost/api/investigations/inv_1/businesses/missing", { method: "DELETE" }), { params: Promise.resolve({ id: "inv_1", businessId: "missing" }) });
    expect(response.status).toBe(404);
  });
});