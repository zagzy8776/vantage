import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const env = process.env as Record<string, string | undefined>;

vi.mock("@/auth/user-store", () => ({
  findUserByEmail: vi.fn(),
  getSessionRecord: vi.fn(),
  getInvestigationAccessInfo: vi.fn(),
}));

import { GET as meGET } from "./me/route";
import { createSessionToken } from "@/auth/tokens";
import { findUserByEmail, getSessionRecord } from "@/auth/user-store";

const mockedFind = vi.mocked(findUserByEmail);
const mockedGetSessionRecord = vi.mocked(getSessionRecord);

function makeMeRequest(cookie?: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/me", {
    headers: cookie ? { cookie } : {},
  });
}

function mintToken(sessionId = "session-abc"): string {
  return createSessionToken(
    {
      userId: "user-1",
      email: "owner@vantage.local",
      role: "owner",
      organizationId: undefined,
    },
    60_000,
    new Date(),
    sessionId
  );
}

describe("GET /api/auth/me (PH1C)", () => {
  beforeEach(() => {
    env.AUTH_SECRET = "test-secret-that-is-long-enough-123456";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns only safe identity fields for a valid session", async () => {
    mockedGetSessionRecord.mockResolvedValue({
      id: "session-abc",
      userId: "user-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockedFind.mockResolvedValue({
      id: "user-1",
      email: "owner@vantage.local",
      name: "Platform Owner",
      role: "owner",
      organizationId: null,
      passwordHash: "$scrypt$secret-material",
      isActive: true,
    });

    const response = await meGET(makeMeRequest(`session=${mintToken()}`));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.user).toEqual({
      id: "user-1",
      email: "owner@vantage.local",
      name: "Platform Owner",
      role: "owner",
      organizationId: undefined,
    });
    // Never leak credential material or session internals
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("secret-material");
  });

  it("returns 401 without a session cookie", async () => {
    const response = await meGET(makeMeRequest());
    expect(response.status).toBe(401);
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it("returns 401 for a tampered token", async () => {
    const response = await meGET(makeMeRequest(`session=${mintToken()}tampered`));
    expect(response.status).toBe(401);
  });

  it("returns 401 when the server-side session record is missing or revoked", async () => {
    mockedGetSessionRecord.mockResolvedValue(null);

    let response = await meGET(makeMeRequest(`session=${mintToken()}`));
    expect(response.status).toBe(401);

    mockedGetSessionRecord.mockResolvedValue({
      id: "session-abc",
      userId: "user-1",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    response = await meGET(makeMeRequest(`session=${mintToken()}`));
    expect(response.status).toBe(401);
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it("fails closed when the user record cannot be confirmed", async () => {
    mockedGetSessionRecord.mockResolvedValue({
      id: "session-abc",
      userId: "user-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockedFind.mockRejectedValue(new Error("db unavailable"));

    const response = await meGET(makeMeRequest(`session=${mintToken()}`));
    expect(response.status).toBe(401);
  });

  it("returns 401 for a deactivated account", async () => {
    mockedGetSessionRecord.mockResolvedValue({
      id: "session-abc",
      userId: "user-1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockedFind.mockResolvedValue({
      id: "user-1",
      email: "owner@vantage.local",
      name: "Platform Owner",
      role: "owner",
      organizationId: null,
      passwordHash: null,
      isActive: false,
    });

    const response = await meGET(makeMeRequest(`session=${mintToken()}`));
    expect(response.status).toBe(401);
  });
});
