import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/security/rate-limiter", () => ({
  checkEndpointRateLimit: vi.fn(() => ({ allowed: true, limit: 10, remaining: 9, reset: Date.now() })),
}));

vi.mock("@/auth/user-store", () => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  recordSession: vi.fn(async () => undefined),
  touchLastLogin: vi.fn(async () => undefined),
  revokeSession: vi.fn(async () => undefined),
  getSessionRecord: vi.fn(),
  ensureOwnerUser: vi.fn(async () => undefined),
  countUsers: vi.fn(async () => 0),
}));

vi.mock("@/auth/password", () => ({
  hashPassword: vi.fn(async () => "scrypt$16384$8$1$ab$cd"),
  verifyPassword: vi.fn(async () => true),
}));

vi.mock("@/auth/verification-store", () => ({
  insertVerification: vi.fn(),
  findLatestPendingVerification: vi.fn(),
  incrementVerificationAttempts: vi.fn(),
  markVerificationVerified: vi.fn(),
  activateUserWithWorkspace: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({
  sendVerificationEmail: vi.fn(async () => ({ sent: true, configured: true })),
  isEmailProviderConfigured: vi.fn(() => true),
}));

import { POST as loginPOST } from "./login/route";
import { POST as resendPOST } from "./resend-verification/route";
import { checkEndpointRateLimit } from "@/lib/security/rate-limiter";
import { ensureOwnerUser, findUserByEmail, recordSession } from "@/auth/user-store";
import { findLatestPendingVerification, insertVerification } from "@/auth/verification-store";
import { sendVerificationEmail } from "@/lib/email/resend";

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockedFind = vi.mocked(findUserByEmail);
const mockedEnsureOwner = vi.mocked(ensureOwnerUser);
const mockedRateLimit = vi.mocked(checkEndpointRateLimit);
const mockedPending = vi.mocked(findLatestPendingVerification);
const mockedInsert = vi.mocked(insertVerification);
const mockedSend = vi.mocked(sendVerificationEmail);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-secret-for-hashing";
  process.env.AUTH_SECRET = "test-auth-secret-for-sessions";
  // Re-prime after clearAllMocks so leaked overrides cannot poison later tests.
  mockedRateLimit.mockReturnValue({ allowed: true, limit: 10, remaining: 9, reset: Date.now() });
  process.env.AUTH_SECRET = 'test-auth-secret-for-sessions';
});

describe("POST /api/auth/login with email verification", () => {
  it("rejects an unverified account without issuing a session", async () => {
    mockedEnsureOwner.mockResolvedValue(undefined);
    mockedFind.mockResolvedValue({
      id: "user_1",
      email: "jane@company.com",
      name: "Jane",
      role: "analyst",
      organizationId: null,
      passwordHash: "hash",
      isActive: true,
      emailVerified: false,
    });

    const response = await loginPOST(jsonRequest("/api/auth/login", { email: "jane@company.com", password: "pw" }));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("EMAIL_NOT_VERIFIED");
    expect(recordSession).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("still authenticates a verified account normally (owner path intact)", async () => {
    mockedEnsureOwner.mockResolvedValue(undefined);
    mockedFind.mockResolvedValue({
      id: "user_2",
      email: "owner@vantage.local",
      name: "Owner",
      role: "owner",
      organizationId: null,
      passwordHash: "hash",
      isActive: true,
      emailVerified: true,
    });

    const response = await loginPOST(jsonRequest("/api/auth/login", { email: "owner@vantage.local", password: "pw" }));

    expect(response.status).toBe(200);
    expect(recordSession).toHaveBeenCalledTimes(1);
    expect(response.headers.get("set-cookie") ?? "").toContain("HttpOnly");
  });

  it("rate limits the login endpoint", async () => {
    mockedRateLimit.mockReturnValue({ allowed: false, limit: 1, remaining: 0, reset: Date.now() });
    const response = await loginPOST(jsonRequest("/api/auth/login", { email: "x@y.co", password: "pw" }));
    expect(response.status).toBe(429);
  });
});

describe("POST /api/auth/resend-verification", () => {
  it("enforces the cooldown between sends", async () => {
    mockedFind.mockResolvedValue({
      id: "user_1",
      email: "jane@company.com",
      name: "Jane",
      role: "analyst",
      organizationId: null,
      passwordHash: null,
      isActive: true,
      emailVerified: false,
    });
    mockedPending.mockResolvedValue({
      id: "ver_1",
      userId: "user_1",
      codeHash: "h",
      expiresAt: new Date(Date.now() + 600_000),
      attempts: 0,
      verifiedAt: null,
      createdAt: new Date(), // just issued -> within cooldown
    });

    const response = await resendPOST(jsonRequest("/api/auth/resend-verification", { email: "jane@company.com" }));
    expect(response.status).toBe(429);
    expect(mockedInsert).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("responds uniformly for unknown emails (no enumeration)", async () => {
    mockedFind.mockResolvedValue(null);
    const response = await resendPOST(jsonRequest("/api/auth/resend-verification", { email: "ghost@x.co" }));
    expect(response.status).toBe(200);
    expect(mockedInsert).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("issues a fresh code after the cooldown elapses", async () => {
    mockedFind.mockResolvedValue({
      id: "user_1",
      email: "jane@company.com",
      name: "Jane",
      role: "analyst",
      organizationId: null,
      passwordHash: null,
      isActive: true,
      emailVerified: false,
    });
    mockedPending.mockResolvedValue({
      id: "ver_1",
      userId: "user_1",
      codeHash: "h",
      expiresAt: new Date(Date.now() + 600_000),
      attempts: 0,
      verifiedAt: null,
      createdAt: new Date(Date.now() - 120_000), // older than cooldown
    });

    const response = await resendPOST(jsonRequest("/api/auth/resend-verification", { email: "jane@company.com" }));
    expect(response.status).toBe(200);
    expect(mockedInsert).toHaveBeenCalledTimes(1);
    expect(mockedSend).toHaveBeenCalledTimes(1);
  });
});
