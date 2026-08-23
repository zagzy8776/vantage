/**
 * PH3: Marketplace API security tests.
 *
 * Verifies that sanitization, XSS rejection, URL validation, and
 * session-based identity attribution are enforced at the API boundary -
 * not just in the underlying service functions.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "user-researcher", email: "res@test.com", role: "researcher" })),
  requireRole: vi.fn(async () => ({ userId: "user-analyst", email: "analyst@test.com", role: "analyst" })),
}));

vi.mock("@/marketplace/service", () => ({
  postTask: vi.fn((...args: unknown[]) => ({ id: "task-1", args })),
  applyForTask: vi.fn((...args: unknown[]) => ({ id: "app-1", args })),
  submitEvidence: vi.fn((...args: unknown[]) => ({ id: "sub-1", args })),
}));

import { POST as postTaskRoute } from "./tasks/route";
import { POST as applyRoute } from "./tasks/[taskId]/applications/route";
import { POST as submitRoute } from "./tasks/[taskId]/submissions/route";
import { postTask, applyForTask, submitEvidence } from "@/marketplace/service";

const mockedPost = vi.mocked(postTask);
const mockedApply = vi.mocked(applyForTask);
const mockedSubmit = vi.mocked(submitEvidence);

function req(url: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost" + url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function routeContext(taskId = "task-1"): { params: Promise<{ taskId: string }> } {
  return { params: Promise.resolve({ taskId }) };
}

describe("Marketplace API security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /tasks", () => {
    it("rejects a negative or non-numeric budget", async () => {
      const base = { investigationId: "inv1", postedBy: "u1", title: "T", description: "D" };
      expect((await postTaskRoute(req("/api/marketplace/tasks", { ...base, budget: -5 }))).status).toBe(400);
      expect((await postTaskRoute(req("/api/marketplace/tasks", { ...base, budget: "lots" }))).status).toBe(400);
      expect((await postTaskRoute(req("/api/marketplace/tasks", { ...base, budget: 2_000_000 }))).status).toBe(400);
    });

    it("rejects XSS in the task description", async () => {
      const response = await postTaskRoute(
        req("/api/marketplace/tasks", {
          investigationId: "inv1",
          postedBy: "u1",
          title: "T",
          description: "<script>alert(1)</script>",
          budget: 100,
        })
      );
      expect(response.status).toBe(400);
    });

    it("accepts a well-formed task and passes sanitized values through", async () => {
      const response = await postTaskRoute(
        req("/api/marketplace/tasks", {
          investigationId: "inv1",
          postedBy: "u1",
          title: "Research spas",
          description: "  Find booking systems  ",
          requirements: ["Booking", 42, ""],
          budget: 500,
        })
      );
      expect(response.status).toBe(201);
      const call = mockedPost.mock.calls[0] as unknown[];
      expect(call[5]).toBe("Find booking systems"); // trimmed
      expect(call[6]).toEqual(["Booking"]); // non-strings filtered
      expect(call[7]).toBe(500);
    });
  });

  describe("POST /tasks/:id/applications", () => {
    it("rejects XSS payloads in the cover letter", async () => {
      const response = await applyRoute(
        req("/api/marketplace/tasks/task-1/applications", {
          applicantId: "someone-else",
          coverLetter: "<script>alert(1)</script>",
        }),
        routeContext()
      );
      expect(response.status).toBe(400);
    });

    it("attributes the application to the authenticated user, ignoring body identity", async () => {
      const response = await applyRoute(
        req("/api/marketplace/tasks/task-1/applications", {
          applicantId: "victim-id",
          applicantEmail: "victim@evil.com",
          coverLetter: "I have five years of experience",
          proposedTimeline: "1 week",
        }),
        routeContext()
      );
      expect(response.status).toBe(201);
      const call = mockedApply.mock.calls[0] as unknown[];
      expect(call[1]).toBe("user-researcher"); // from session, not body
      expect(call[3]).toBe("res@test.com"); // from session, not body
    });
  });

  describe("POST /tasks/:id/submissions", () => {
    const validEvidence = [
      { statement: "Spa uses Bookify for bookings", category: "booking", sourceUrl: "https://spa.com", confidence: 80 },
      { statement: "Pricing starts at 50 dollars", category: "pricing", sourceUrl: "https://spa.com/pricing", confidence: 70 },
      { statement: "Open nine to six daily", category: "hours", sourceUrl: "https://spa.com/hours", confidence: 90 },
    ];
    const validSources = [
      { url: "https://spa.com", title: "Homepage", type: "website" },
      { url: "https://spa.com/pricing", title: "Pricing", type: "website" },
    ];
    const validBase = {
      submittedBy: "victim-id",
      submittedByName: "Someone Else",
      observations: ["Observed booking widget"],
      unknowns: ["Weekend pricing unclear"],
    };

    it("rejects javascript: URLs in sources", async () => {
      const response = await submitRoute(
        req("/api/marketplace/tasks/task-1/submissions", {
          ...validBase,
          evidence: validEvidence,
          sources: [{ url: "javascript:alert(1)", title: "Evil", type: "website" }],
          notes: "Notes notes notes notes notes notes.",
        }),
        routeContext()
      );
      expect(response.status).toBe(400);
    });

    it("rejects script injection in evidence statements", async () => {
      const response = await submitRoute(
        req("/api/marketplace/tasks/task-1/submissions", {
          ...validBase,
          evidence: [{ ...validEvidence[0], statement: "<script>alert(1)</script>" }],
          sources: validSources,
          notes: "Notes notes notes notes notes notes.",
        }),
        routeContext()
      );
      expect(response.status).toBe(400);
    });

    it("attributes the submission to the authenticated researcher", async () => {
      const response = await submitRoute(
        req("/api/marketplace/tasks/task-1/submissions", {
          ...validBase,
          evidence: validEvidence,
          sources: validSources,
          notes: "Research conducted on site and via public pages over two days.",
        }),
        routeContext()
      );
      expect(response.status).toBe(201);
      const call = mockedSubmit.mock.calls[0] as unknown[];
      expect(call[1]).toBe("user-researcher"); // session identity wins over body
    });
  });
});
