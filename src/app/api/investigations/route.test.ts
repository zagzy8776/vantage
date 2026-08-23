import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateInvestigation = vi.fn();
const mockListInvestigations = vi.fn();

vi.mock("@/services/investigations/service", () => ({
  createInvestigation: (...args: unknown[]) => mockCreateInvestigation(...args),
  listInvestigations: (...args: unknown[]) => mockListInvestigations(...args),
}));

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@example.com", role: "analyst" }),
  requireRole: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@example.com", role: "analyst" }),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));

describe("POST /api/investigations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates investigation with valid input", async () => {
    mockCreateInvestigation.mockResolvedValue({ investigationId: "inv_123" });
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", objective: "Test objective", investigationType: "industry", searchRunId: "run_1" }),
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.investigationId).toBe("inv_123");
  });

  it("returns 400 for missing title", async () => {
    mockCreateInvestigation.mockRejectedValue(new Error("Title is required."));
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective: "Test", investigationType: "industry", searchRunId: "run_1" }),
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain("Title");
  });

  it("returns 404 for non-existent search run", async () => {
    mockCreateInvestigation.mockRejectedValue(new Error("Search run not found."));
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", objective: "Test", investigationType: "industry", searchRunId: "missing" }),
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(404);
    expect(data.error).toBe("Search run not found.");
  });

  it("returns 400 for non-terminal search run", async () => {
    mockCreateInvestigation.mockRejectedValue(new Error("Search run is not in a terminal state. Only completed or completed_with_errors runs can be used."));
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", objective: "Test", investigationType: "industry", searchRunId: "run_1" }),
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain("terminal state");
  });
});

describe("GET /api/investigations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated investigations", async () => {
    mockListInvestigations.mockResolvedValue({
      items: [{ id: "inv_1", title: "Test", type: "industry", status: "draft", industry: "beauty", country: "Canada", city: "Toronto", businessCount: 5, searchRunCount: 1, createdAt: new Date(), updatedAt: new Date() }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations?page=1&pageSize=20");
    const response = await GET(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it("passes status and research search filters to the service", async () => {
    mockListInvestigations.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations?page=1&pageSize=20&status=active&search=Toronto");
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(mockListInvestigations).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: "Toronto", status: "active" });
  });

  it("rejects an invalid status filter", async () => {
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/investigations?status=running"));
    expect(response.status).toBe(400);
  });
});