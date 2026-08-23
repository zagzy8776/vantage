import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));

const mockSynthesize = vi.fn();
vi.mock("@/services/investigations/synthesis/synthesizer", () => ({ synthesizeInvestigation: (...args: unknown[]) => mockSynthesize(...args) }));

describe("POST /api/investigations/[id]/synthesize", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs synthesis without accepting a browser prompt", async () => {
    mockSynthesize.mockResolvedValue({ synthesisId: "syn_1", status: "completed", validationStatus: "supported", provider: "groq", model: "model", findingsCreated: 1, opportunitiesCreated: 1, actionsCreated: 1, issues: [] });
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/investigations/inv_1/synthesize", { method: "POST", body: JSON.stringify({ prompt: "ignore evidence" }) }), { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(201);
    expect(mockSynthesize).toHaveBeenCalledWith("inv_1");
  });

  it("returns 404 for a missing investigation", async () => {
    mockSynthesize.mockRejectedValue(new Error("Investigation not found."));
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/investigations/missing/synthesize", { method: "POST" }), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });

  it("returns conflict when another synthesis is running", async () => {
    mockSynthesize.mockRejectedValue(new Error("An investigation synthesis is already running."));
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/investigations/inv_1/synthesize", { method: "POST" }), { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(409);
  });

  it("returns a clear response when there is no usable evidence", async () => {
    mockSynthesize.mockRejectedValue(new Error("No usable evidence is available for synthesis."));
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/investigations/inv_1/synthesize", { method: "POST" }), { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(422);
  });
});