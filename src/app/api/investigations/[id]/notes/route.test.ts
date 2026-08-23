import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireRole: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
  requireInvestigationAccess: vi.fn(async () => ({ userId: "test-user", email: "test@example.com", role: "analyst" })),
}));

const mockCreateNote = vi.fn();

vi.mock("@/services/investigations/service", () => ({
  createNote: (...args: unknown[]) => mockCreateNote(...args),
}));

describe("POST /api/investigations/[id]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a note with author and content", async () => {
    mockCreateNote.mockResolvedValue({
      id: "note_1",
      investigationId: "inv_1",
      author: "Lead Engineer",
      content: "Check competitor pricing.",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "Lead Engineer", content: "Check competitor pricing." }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: "inv_1" }) });
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.id).toBe("note_1");
    expect(mockCreateNote).toHaveBeenCalledWith("inv_1", { author: "Lead Engineer", content: "Check competitor pricing." });
  });

  it("defaults the author when not supplied", async () => {
    mockCreateNote.mockResolvedValue({ id: "note_2", investigationId: "inv_1", author: "Analyst", content: "x", createdAt: new Date(), updatedAt: new Date() });
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "x" }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(201);
    expect(mockCreateNote).toHaveBeenCalledWith("inv_1", { author: "Analyst", content: "x" });
  });

  it("rejects empty content", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "   " }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid body", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/investigations/inv_1/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "inv_1" }) });
    expect(response.status).toBe(400);
  });
});