import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));
import { POST } from "./route";

vi.mock("@/services/website-analysis/service", () => ({
  analyzeBusinessWebsite: vi.fn(async () => ({
    businessId: "biz_1",
    url: "https://example.com",
    canonicalUrl: "https://example.com/",
    normalizedUrl: "https://example.com/",
    status: "success",
    errorCode: null,
    analyzedAt: "2026-08-20T00:00:00.000Z",
    reused: false,
    performanceScore: 41,
    accessibilityScore: 58,
    bestPracticesScore: 72,
    seoScore: 62,
    technicalHealthScore: 58,
    websiteStatus: "poor",
    evidence: { hasWebsite: true },
  })),
}));

describe("POST /api/websites/analyze", () => {
  it("rejects invalid payloads", async () => {
    const response = await POST(new NextRequest("http://localhost/api/websites/analyze", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });
});