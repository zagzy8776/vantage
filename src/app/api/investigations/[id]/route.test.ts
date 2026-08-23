import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetInvestigationDetail = vi.fn();
const mockUpdateInvestigation = vi.fn();

vi.mock("@/services/investigations/service", () => ({
  getInvestigationDetail: (...args: unknown[]) => mockGetInvestigationDetail(...args),
  updateInvestigation: (...args: unknown[]) => mockUpdateInvestigation(...args),
}));

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@example.com", role: "analyst" }),
  requireRole: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@example.com", role: "analyst" }),
  requireResourceAccess: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@example.com", role: "analyst" }),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));

describe("GET /api/investigations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns investigation detail", async () => {
    mockGetInvestigationDetail.mockResolvedValue({
      id: "inv_1",
      title: "Test",
      objective: "Test objective",
      investigationType: "industry",
      status: "draft",
      industry: "beauty",
      country: "Canada",
      region: null,
      city: "Toronto",
      criteria: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      searchRuns: [],
      businesses: [],
      sources: [],
      claims: [],
      findings: [],
      opportunities: [],
      actions: [],
      notes: [],
      businessDetails: [],
      evidenceItems: [],
      sourceConflicts: [],
      aiConflicts: [],
      runDetails: [],
      metrics: { businesses: 0, searchRuns: 0, sources: 0, evidence: 0, supportedClaims: 0, findings: 0, opportunities: 0, unknowns: 0, contradictions: 0 },
    });
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1");
    const response = await GET(request, { params: Promise.resolve({ id: "inv_1" }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.id).toBe("inv_1");
  });

  it("returns 404 for non-existent investigation", async () => {
    mockGetInvestigationDetail.mockResolvedValue(null);
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/missing");
    const response = await GET(request, { params: Promise.resolve({ id: "missing" }) });
    const data = await response.json();
    expect(response.status).toBe(404);
    expect(data.error).toBe("Investigation not found.");
  });
});

describe("PATCH /api/investigations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["draft", "active", "completed", "archived"] as const)("updates status to %s", async (status) => {
    mockUpdateInvestigation.mockResolvedValue(true);
    const { PATCH } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "inv_1" }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe(status);
    expect(mockUpdateInvestigation).toHaveBeenCalledWith("inv_1", { status });
  });

  it("updates title and objective", async () => {
    mockUpdateInvestigation.mockResolvedValue(true);
    const { PATCH } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New title", objective: "New objective" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(200);
    expect(mockUpdateInvestigation).toHaveBeenCalledWith("inv_1", { title: "New title", objective: "New objective" });
  });

  it("rejects invalid status values", async () => {
    const { PATCH } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "running" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(400);
  });

  it("rejects empty title", async () => {
    const { PATCH } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   " }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(400);
  });

  it("returns 404 when investigation does not exist", async () => {
    mockUpdateInvestigation.mockResolvedValue(false);
    const { PATCH } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/missing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid body", async () => {
    const { PATCH } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(400);
  });
});