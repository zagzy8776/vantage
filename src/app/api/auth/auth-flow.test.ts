import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const env = process.env as Record<string, string | undefined>;

vi.mock("@/auth/user-store", () => ({
  findUserByEmail: vi.fn(),
  recordSession: vi.fn(async () => undefined),
  touchLastLogin: vi.fn(async () => undefined),
  revokeSession: vi.fn(async () => undefined),
  ensureOwnerUser: vi.fn(async () => undefined),
}));

vi.mock("@/lib/security/rate-limiter", () => ({
  checkEndpointRateLimit: vi.fn(() => ({ allowed: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 })),
}));

import { POST as loginPOST } from "./login/route";
import { POST as logoutPOST } from "./logout/route";
import { findUserByEmail, recordSession, revokeSession } from "@/auth/user-store";
import { hashPassword } from "@/auth/password";

const mockedFind = vi.mocked(findUserByEmail);
const mockedRecord = vi.mocked(recordSession);
const mockedRevoke = vi.mocked(revokeSession);

function makeLoginRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 200) + 5}` },
    body: JSON.stringify(body),
  });
}

describe("Auth flow (PH1B)", () => {
  beforeEach(() => {
    env.AUTH_SECRET = "test-secret-that-is-long-enough-123456";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("logs in with valid credentials and sets an HttpOnly session cookie", async () => {
    const passwordHash = await hashPassword("hunter2-hunter2-hunter2");
    mockedFind.mockResolvedValue({
      id: "user-1",
      email: "analyst@test.com",
      name: "Analyst",
      role: "analyst",
      organizationId: "org-a",
      passwordHash,
      isActive: true,
    });

    const response = await loginPOST(makeLoginRequest({ email: "analyst@test.com", password: "hunter2-hunter2-hunter2" }));
    expect(response.status).toBe(200);

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie.startsWith("session=")).toBe(true);

    expect(mockedRecord).toHaveBeenCalledTimes(1);
    const body = await response.json();
    expect(body.user.email).toBe("analyst@test.com");
    // Never leak credential material
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("rejects a wrong password with a generic 401", async () => {
    const passwordHash = await hashPassword("hunter2-hunter2-hunter2");
    mockedFind.mockResolvedValue({
      id: "user-1",
      email: "analyst@test.com",
      name: "Analyst",
      role: "analyst",
      organizationId: null,
      passwordHash,
      isActive: true,
    });

    const response = await loginPOST(makeLoginRequest({ email: "analyst@test.com", password: "wrong-password" }));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Invalid email or password");
  });

  it("does not reveal whether an email exists (unknown email -> generic 401)", async () => {
    mockedFind.mockResolvedValue(null);

    const response = await loginPOST(makeLoginRequest({ email: "nobody@test.com", password: "whatever" }));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Invalid email or password");
  });

  it("rejects inactive accounts", async () => {
    mockedFind.mockResolvedValue({
      id: "user-2",
      email: "offboarded@test.com",
      name: "Offboarded",
      role: "analyst",
      organizationId: null,
      passwordHash: await hashPassword("hunter2-hunter2-hunter2"),
      isActive: false,
    });

    const response = await loginPOST(makeLoginRequest({ email: "offboarded@test.com", password: "hunter2-hunter2-hunter2" }));
    expect(response.status).toBe(401);
  });

  it("revokes the server-side session on logout and clears the cookie", async () => {
    env.AUTH_SECRET = "test-secret-that-is-long-enough-123456";
    // Mint a real token via the actual login path pieces
    const passwordHash = await hashPassword("hunter2-hunter2-hunter2");
    mockedFind.mockResolvedValue({
      id: "user-1",
      email: "analyst@test.com",
      name: "Analyst",
      role: "analyst",
      organizationId: null,
      passwordHash,
      isActive: true,
    });
    const loginResponse = await loginPOST(makeLoginRequest({ email: "analyst@test.com", password: "hunter2-hunter2-hunter2" }));
    const cookieToken = (loginResponse.headers.get("set-cookie") ?? "")
      .split(";")[0]
      .replace(/^session=/, "");


    const logoutResponse = await logoutPOST(
      new NextRequest("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { cookie: `session=${cookieToken}` },
      })
    );

    expect(logoutResponse.status).toBe(200);
    expect(mockedRevoke).toHaveBeenCalledTimes(1);
    const clearCookie = logoutResponse.headers.get("set-cookie") ?? "";
    expect(clearCookie).toContain("Max-Age=0");
  });
});
