import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSessionToken, verifySessionToken } from "./tokens";
import type { Session } from "./types";

/**
 * Writable env view (Next.js types mark NODE_ENV etc. read-only)
 */
const env = process.env as Record<string, string | undefined>;

describe("Session Tokens", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    env.AUTH_SECRET = "test-secret-that-is-long-enough-123456";
  });

  afterEach(() => {
    const current = process.env as Record<string, string | undefined>;
    for (const key of Object.keys(current)) {
      if (!(key in originalEnv)) {
        delete current[key];
      }
    }
    for (const key of Object.keys(originalEnv)) {
      current[key] = originalEnv[key];
    }
  });

  const session = {
    userId: "user-1",
    email: "analyst@example.com",
    role: "analyst" as Session["role"],
    organizationId: "org-1",
  };

  describe("createSessionToken", () => {
    it("creates a token with version prefix and three parts", () => {
      const token = createSessionToken(session);

      const parts = token.split(".");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe("v1");
    });

    it("throws when AUTH_SECRET is not configured", () => {
      delete env.AUTH_SECRET;

      expect(() => createSessionToken(session)).toThrow("AUTH_SECRET");
    });
  });

  describe("verifySessionToken", () => {
    it("verifies a freshly created token", () => {
      const token = createSessionToken(session);
      const result = verifySessionToken(token);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user-1");
      expect(result?.email).toBe("analyst@example.com");
      expect(result?.role).toBe("analyst");
      expect(result?.organizationId).toBe("org-1");
    });

    it("rejects a tampered payload", () => {
      const token = createSessionToken(session);
      const parts = token.split(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: "attacker", email: "x@x.com", role: "admin", iat: Date.now(), exp: Date.now() + 999999 })
      ).toString("base64url");

      const result = verifySessionToken(`v1.${tamperedPayload}.${parts[2]}`);
      expect(result).toBeNull();
    });

    it("rejects an invalid signature", () => {
      const token = createSessionToken(session);
      const parts = token.split(".");
      const result = verifySessionToken(`${parts[0]}.${parts[1]}.AAAAinvalidsignature`);
      expect(result).toBeNull();
    });

    it("rejects an expired token", () => {
      const issuedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const token = createSessionToken(session, 60 * 60 * 1000, issuedAt); // 1h TTL, issued 2h ago

      const result = verifySessionToken(token);
      expect(result).toBeNull();
    });

    it("rejects malformed tokens", () => {
      expect(verifySessionToken(null)).toBeNull();
      expect(verifySessionToken(undefined)).toBeNull();
      expect(verifySessionToken("")).toBeNull();
      expect(verifySessionToken("not-a-token")).toBeNull();
      expect(verifySessionToken("a.b.c")).toBeNull();
      expect(verifySessionToken("v2.abc.def")).toBeNull();
    });

    it("fails closed when AUTH_SECRET is missing", () => {
      delete env.AUTH_SECRET;
      expect(verifySessionToken("v1.abc.def")).toBeNull();
    });

    it("rejects tokens signed with a different secret", () => {
      const token = createSessionToken(session);

      env.AUTH_SECRET = "a-completely-different-secret-value";

      expect(verifySessionToken(token)).toBeNull();
    });
  });
});
