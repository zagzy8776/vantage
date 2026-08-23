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

import { POST as signupPOST } from "./route";
import { POST as verifyPOST } from "../verify-email/route";
import { checkEndpointRateLimit } from "@/lib/security/rate-limiter";
import { createUser, findUserByEmail, recordSession } from "@/auth/user-store";
import {
  activateUserWithWorkspace,
  findLatestPendingVerification,
  incrementVerificationAttempts,
  insertVerification,
  markVerificationVerified,
} from "@/auth/verification-store";
import { sendVerificationEmail } from "@/lib/email/resend";
import { hashCodeVerification, CODE_TTL_MS } from "@/auth/verification";

export function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockedFind = vi.mocked(findUserByEmail);
const mockedCreate = vi.mocked(createUser);
const mockedRateLimit = vi.mocked(checkEndpointRateLimit);
const mockedInsert = vi.mocked(insertVerification);
const mockedPending = vi.mocked(findLatestPendingVerification);
const mockedSend = vi.mocked(sendVerificationEmail);
const mockedActivate = vi.mocked(activateUserWithWorkspace);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-secret-for-hashing";
  process.env.AUTH_SECRET = "test-auth-secret-for-sessions";
  // Re-prime after clearAllMocks so leaked overrides cannot poison later tests.
  mockedRateLimit.mockReturnValue({ allowed: true, limit: 10, remaining: 9, reset: Date.now() });
});

describe("POST /api/auth/signup", () => {
  it("creates an unverified account and emails a 6-digit code", async () => {
    mockedFind.mockResolvedValue(null);
    mockedCreate.mockResolvedValue({
      id: "user_1",
      email: "jane@company.com",
      name: "Jane",
      role: "analyst",
      organizationId: null,
      passwordHash: null,
      isActive: true,
      emailVerified: false,
    });
    mockedPending.mockResolvedValue(null);

    const response = await signupPOST(
      jsonRequest("/api/auth/signup", {
        name: "Jane",
        email: "jane@company.com",
        password: "Sunset9Sky",
        confirmPassword: "Sunset9Sky",
      })
    );

    expect(response.status).toBe(200);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@company.com", emailVerified: false })
    );
    expect(mockedInsert).toHaveBeenCalledTimes(1);
    const sentCode = mockedSend.mock.calls[0][1];
    expect(sentCode).toMatch(/^\d{6}$/);
    // The persisted hash must never be the plaintext code.
    expect(mockedInsert.mock.calls[0][0].codeHash).not.toBe(sentCode);
  });

  it("gives a uniform response (and sends nothing) for an existing verified email", async () => {
    mockedFind.mockResolvedValue({
      id: "user_x",
      email: "taken@company.com",
      name: "Taken",
      role: "owner",
      organizationId: null,
      passwordHash: null,
      isActive: true,
      emailVerified: true,
    });

    const response = await signupPOST(
      jsonRequest("/api/auth/signup", {
        name: "Anyone",
        email: "taken@company.com",
        password: "Sunset9Sky",
        confirmPassword: "Sunset9Sky",
      })
    );

    expect(response.status).toBe(200);
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("rate limits abusive clients", async () => {
    mockedRateLimit.mockReturnValue({ allowed: false, limit: 1, remaining: 0, reset: Date.now() });
    const response = await signupPOST(
      jsonRequest("/api/auth/signup", { name: "A", email: "a@b.co", password: "Sunset9Sky" })
    );
    expect(response.status).toBe(429);
  });

  it("rejects invalid payloads server-side", async () => {
    const weak = await signupPOST(
      jsonRequest("/api/auth/signup", { name: "J", email: "j@b.co", password: "weak", confirmPassword: "weak" })
    );
    expect(weak.status).toBe(400);

    const badEmail = await signupPOST(
      jsonRequest("/api/auth/signup", { name: "J", email: "nope", password: "Sunset9Sky", confirmPassword: "Sunset9Sky" })
    );
    expect(badEmail.status).toBe(400);
  });
});

describe("POST /api/auth/verify-email", () => {
  const unverifiedUser = {
    id: "user_1",
    email: "jane@company.com",
    name: "Jane",
    role: "analyst" as const,
    organizationId: null,
    passwordHash: null,
    isActive: true,
    emailVerified: false,
  };

  function makePending(overrides?: Record<string, unknown>) {
    return {
      id: "ver_1",
      userId: "user_1",
      codeHash: hashCodeVerification("123456"),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      attempts: 0,
      verifiedAt: null,
      createdAt: new Date(Date.now() - 30_000),
      ...overrides,
    };
  }

  beforeEach(() => {
    mockedFind.mockResolvedValue(unverifiedUser);
    mockedActivate.mockResolvedValue({ organizationId: "org_new", role: "owner" });
  });

  it("activates the account, creates the workspace, assigns Owner and issues a session", async () => {
    mockedPending.mockResolvedValue(makePending());

    const response = await verifyPOST(
      jsonRequest("/api/auth/verify-email", { email: "jane@company.com", code: "123456" })
    );

    expect(response.status).toBe(200);
    expect(markVerificationVerified).toHaveBeenCalledWith("ver_1");
    expect(mockedActivate).toHaveBeenCalledWith({ userId: "user_1", name: "Jane" });
    expect(recordSession).toHaveBeenCalledTimes(1); // server-side session created
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const body = await response.json();
    expect(body.user.role).toBe("owner");
    expect(body.user.organizationId).toBe("org_new");
  });

  it("rejects an incorrect code and consumes an attempt", async () => {
    mockedPending.mockResolvedValue(makePending());
    const response = await verifyPOST(
      jsonRequest("/api/auth/verify-email", { email: "jane@company.com", code: "999999" })
    );
    expect(response.status).toBe(400);
    expect(incrementVerificationAttempts).toHaveBeenCalledWith("ver_1");
    expect(markVerificationVerified).not.toHaveBeenCalled();
    expect(mockedActivate).not.toHaveBeenCalled();
  });

  it("rejects an expired code", async () => {
    mockedPending.mockResolvedValue(makePending({ expiresAt: new Date(Date.now() - 1000) }));
    const response = await verifyPOST(
      jsonRequest("/api/auth/verify-email", { email: "jane@company.com", code: "123456" })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("EXPIRED");
  });

  it("rejects when max attempts are exhausted", async () => {
    mockedPending.mockResolvedValue(makePending({ attempts: 5 }));
    const response = await verifyPOST(
      jsonRequest("/api/auth/verify-email", { email: "jane@company.com", code: "123456" })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("never reveals whether an email exists", async () => {
    mockedFind.mockResolvedValue(null);
    const response = await verifyPOST(
      jsonRequest("/api/auth/verify-email", { email: "ghost@x.co", code: "123456" })
    );
    expect(response.status).toBe(400);
  });
});


