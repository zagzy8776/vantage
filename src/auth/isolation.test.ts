/**
 * PH1B: Tenant isolation / IDOR tests.
 *
 * Exercises the real middleware stack (signed tokens + session store +
 * access resolution) against a mocked persistence layer.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const env = process.env as Record<string, string | undefined>;

vi.mock("@/auth/user-store", () => ({
  getSessionRecord: vi.fn(),
  getInvestigationAccessInfo: vi.fn(),
}));

import { requireInvestigationAccess } from "./middleware";
import { createSessionToken } from "./tokens";
import { getSessionRecord, getInvestigationAccessInfo } from "@/auth/user-store";

const mockedGetSession = vi.mocked(getSessionRecord);
const mockedAccess = vi.mocked(getInvestigationAccessInfo);

function makeRequest(token: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `session=${token}`;
  return new NextRequest("http://localhost/api/investigations/inv-1", { headers });
}

async function login(userId: string, role: string, orgId?: string): Promise<string> {
  env.AUTH_SECRET = env.AUTH_SECRET || "test-secret-that-is-long-enough-123456";
  const token = createSessionToken(
    { userId, email: `${userId}@test.com`, role: role as never, organizationId: orgId },
    undefined,
    undefined,
    `sess-${userId}`
  );
  mockedGetSession.mockImplementation(async (id: string) =>
    id === `sess-${userId}`
      ? { id, userId, revokedAt: null, expiresAt: new Date(Date.now() + 3_600_000) }
      : null
  );
  return token;
}

describe("Tenant isolation (IDOR)", () => {
  beforeEach(() => {
    env.AUTH_SECRET = "test-secret-that-is-long-enough-123456";
    mockedAccess.mockResolvedValue({
      ownerId: "user-a",
      organizationId: "org-a",
      sharedWith: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("allows the owner full access", async () => {
    const token = await login("user-a", "analyst", "org-a");
    const result = await requireInvestigationAccess(makeRequest(token), "inv-1", "write");
    expect((result as { userId?: string }).userId).toBe("user-a");
  });

  it("blocks an unrelated analyst from another organization (IDOR)", async () => {
    const token = await login("user-b", "analyst", "org-b");
    const result = await requireInvestigationAccess(makeRequest(token), "inv-1", "read");
    expect((result as { status: number }).status).toBe(403);
  });

  it("blocks a researcher from another organization (different role, same outcome)", async () => {
    const token = await login("user-r", "researcher", "org-b");
    const result = await requireInvestigationAccess(makeRequest(token), "inv-1", "read");
    expect((result as { status: number }).status).toBe(403);
  });

  it("allows members of the same organization write-level collaboration", async () => {
    const token = await login("user-c", "analyst", "org-a");
    const result = await requireInvestigationAccess(makeRequest(token), "inv-1", "write");
    expect((result as { userId?: string }).userId).toBe("user-c");
  });

  it("honors explicit read-only shares (read ok, write denied)", async () => {
    mockedAccess.mockResolvedValue({
      ownerId: "user-a",
      organizationId: null,
      sharedWith: [{ userId: "user-shared", permission: "read" as never }],
    });

    const token = await login("user-shared", "client");
    const read = await requireInvestigationAccess(makeRequest(token), "inv-1", "read");
    expect((read as { userId?: string }).userId).toBe("user-shared");

    const write = await requireInvestigationAccess(makeRequest(token), "inv-1", "write");
    expect((write as { status: number }).status).toBe(403);
  });

  it("gives platform admins cross-tenant read access but not write", async () => {
    const adminToken = await login("platform-admin", "admin");
    const read = await requireInvestigationAccess(makeRequest(adminToken), "inv-1", "read");
    expect((read as { userId?: string }).userId).toBe("platform-admin");

    const write = await requireInvestigationAccess(makeRequest(adminToken), "inv-1", "write");
    expect((write as { status: number }).status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const result = await requireInvestigationAccess(makeRequest(null), "inv-1", "read");
    expect((result as { status: number }).status).toBe(401);
  });

  it("rejects revoked sessions with 401 even with a valid signature", async () => {
    await login("user-a", "analyst", "org-a"); // registers session mock
    const token = createSessionToken({
      userId: "user-a",
      email: "user-a@test.com",
      role: "analyst",
      organizationId: "org-a",
    }, undefined, undefined, "revoked-sess");

    mockedGetSession.mockResolvedValue({
      id: "revoked-sess",
      userId: "user-a",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const result = await requireInvestigationAccess(makeRequest(token), "inv-1", "read");
    expect((result as { status: number }).status).toBe(401);
  });

  it("rejects tampered tokens with 401", async () => {
    const token = await login("user-a", "analyst", "org-a");
    const tampered = `${token.slice(0, -4)}AAAA`;
    const result = await requireInvestigationAccess(makeRequest(tampered), "inv-1", "read");
    expect((result as { status: number }).status).toBe(401);
  });

  it("returns 404 for unknown investigations without leaking existence", async () => {
    mockedAccess.mockResolvedValue(null);
    const token = await login("user-a", "analyst", "org-a");
    const result = await requireInvestigationAccess(makeRequest(token), "does-not-exist", "read");
    expect((result as { status: number }).status).toBe(404);
  });
});

