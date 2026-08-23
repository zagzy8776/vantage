import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));

const mockCreateStandaloneInvestigation = vi.fn();

vi.mock("@/services/investigations/service", () => ({
  createStandaloneInvestigation: (...args: unknown[]) => mockCreateStandaloneInvestigation(...args),
}));

describe("POST /api/investigations/standalone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a standalone investigation with a draft plan", async () => {
    mockCreateStandaloneInvestigation.mockResolvedValue({ 
      investigationId: "inv_123", 
      planId: "plan_123", 
      planVersion: 1 
    });
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/investigations/standalone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Standalone Investigation",
        objective: "Identify evidence-backed operational problems among restaurants in Lagos.",
        investigationType: "problem",
        industry: "Restaurants",
        geography: {
          country: "Nigeria",
          region: "Lagos",
          city: "Lagos",
        },
        problemCategory: "appointment_no_shows",
        researchQuestion: "What evidence would suggest appointment/no-show workflow problems?",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.investigationId).toBe("inv_123");
    expect(data.planId).toBe("plan_123");
    expect(data.planVersion).toBe(1);
    expect(mockCreateStandaloneInvestigation).toHaveBeenCalledWith({
      title: "Test Standalone Investigation",
      objective: "Identify evidence-backed operational problems among restaurants in Lagos.",
      investigationType: "problem",
      industry: "Restaurants",
      geography: {
        country: "Nigeria",
        region: "Lagos",
        city: "Lagos",
      },
      problemCategory: "appointment_no_shows",
      researchQuestion: "What evidence would suggest appointment/no-show workflow problems?",
    });
  });

  it("validates required fields", async () => {
    mockCreateStandaloneInvestigation.mockRejectedValue(new Error("Title is required."));
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/investigations/standalone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "",
        objective: "",
        investigationType: "problem",
        geography: {
          country: "",
        },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("requires problem category for problem investigations", async () => {
    mockCreateStandaloneInvestigation.mockRejectedValue(new Error("Problem category is required for problem investigations."));
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/investigations/standalone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Investigation",
        objective: "Test objective",
        investigationType: "problem",
        geography: {
          country: "Nigeria",
        },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Problem category");
  });

  it("requires service category for service opportunity investigations", async () => {
    mockCreateStandaloneInvestigation.mockRejectedValue(new Error("Service category is required for service opportunity investigations."));
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/investigations/standalone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Investigation",
        objective: "Test objective",
        investigationType: "service_opportunity",
        geography: {
          country: "Nigeria",
        },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Service category");
  });

  it("requires country in geography", async () => {
    mockCreateStandaloneInvestigation.mockRejectedValue(new Error("Country is required in geography."));
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/investigations/standalone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Investigation",
        objective: "Test objective",
        investigationType: "industry",
        geography: {},
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Country");
  });

  it("handles invalid investigation type", async () => {
    mockCreateStandaloneInvestigation.mockRejectedValue(new Error("Invalid investigation type."));
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost:3000/api/investigations/standalone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Investigation",
        objective: "Test objective",
        investigationType: "invalid_type",
        geography: {
          country: "Nigeria",
        },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid investigation type");
  });
});
