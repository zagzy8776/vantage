import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));

const mockSynthesize = vi.fn();
vi.mock("@/services/investigations/opportunity/synthesizer", () => ({ synthesizeOpportunityInvestigation: (...args: unknown[]) => mockSynthesize(...args) }));

describe("POST /api/investigations/[id]/opportunity-synthesis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs a problem/service opportunity investigation", async () => {
    mockSynthesize.mockResolvedValue({ status: "supported", provider: "groq", model: "model", findingsCreated: 1, opportunitiesCreated: 1, actionsCreated: 2, unknowns: [], signals: [], issues: [] });
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/investigations/inv_1/opportunity-synthesis", { method: "POST" }), { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(201);
    expect(mockSynthesize).toHaveBeenCalledWith("inv_1");
  });

  it("maps invalid investigation type and no-evidence states", async () => {
    const { POST } = await import("./route");
    mockSynthesize.mockRejectedValueOnce(new Error("Opportunity synthesis requires a problem or service opportunity investigation."));
    expect((await POST(new NextRequest("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: "inv_1" }) })).status).toBe(400);
    mockSynthesize.mockRejectedValueOnce(new Error("No usable evidence is available for opportunity investigation."));
    expect((await POST(new NextRequest("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: "inv_1" }) })).status).toBe(422);
  });
});