import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));

const mockSynthesize = vi.fn();
vi.mock("@/services/investigations/market/synthesizer", () => ({ synthesizeMarket: (...args: unknown[]) => mockSynthesize(...args) }));

describe("POST /api/investigations/[id]/market-synthesis", () => {
  beforeEach(() => vi.clearAllMocks());
  it("runs market synthesis for an investigation", async () => {
    mockSynthesize.mockResolvedValue({ synthesisId: "market_1", status: "completed", validationStatus: "supported", provider: "groq", model: "model", patternsCreated: 1, opportunitiesCreated: 1, actionsCreated: 1, issues: [] });
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/investigations/inv_1/market-synthesis", { method: "POST" }), { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(201);
    expect(mockSynthesize).toHaveBeenCalledWith("inv_1");
  });
  it("maps duplicate-running and no-evidence states", async () => {
    const { POST } = await import("./route");
    mockSynthesize.mockRejectedValueOnce(new Error("A market synthesis is already running."));
    expect((await POST(new NextRequest("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: "inv_1" }) })).status).toBe(409);
    mockSynthesize.mockRejectedValueOnce(new Error("No usable evidence is available for market synthesis."));
    expect((await POST(new NextRequest("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: "inv_1" }) })).status).toBe(422);
  });
});