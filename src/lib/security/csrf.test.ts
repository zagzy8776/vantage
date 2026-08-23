import { describe, it, expect, beforeEach } from "vitest";
import {
  createCsrfToken,
  validateCsrfToken,
  invalidateCsrfToken,
  generateCsrfTokenForClient,
  validateCsrfTokenFromClient,
  requireCsrfToken,
  addCsrfTokenToHeaders,
  CSRF_PROTECTED_METHODS,
  CSRF_SAFE_METHODS,
  requiresCsrfProtection,
  isSafeMethod,
} from "./csrf";

describe("CSRF Protection", () => {
  const secret = "test-secret-key";

  beforeEach(() => {
    // Tokens are stored with unique identifiers, so we don't need explicit cleanup
  });

  describe("createCsrfToken", () => {
    it("creates a token with expiration", () => {
      const config = { secret };
      const result = createCsrfToken(config, 60000);
      
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it("token contains salt and signature", () => {
      const config = { secret };
      const result = createCsrfToken(config);
      
      expect(result.token).toContain(".");
    });
  });

  describe("validateCsrfToken", () => {
    it("validates a valid token", () => {
      const config = { secret };
      const { token } = createCsrfToken(config);
      
      const result = validateCsrfToken(token, config);
      expect(result).toBe(true);
    });

    it("rejects invalid token", () => {
      const config = { secret };
      const result = validateCsrfToken("invalid-token", config);
      expect(result).toBe(false);
    });

    it("rejects expired token", () => {
      const config = { secret };
      const { token } = createCsrfToken(config, -1); // Already expired
      
      const result = validateCsrfToken(token, config);
      expect(result).toBe(false);
    });
  });

  describe("invalidateCsrfToken", () => {
    it("invalidates a token", () => {
      const config = { secret };
      const { token } = createCsrfToken(config);
      
      expect(validateCsrfToken(token, config)).toBe(true);
      
      invalidateCsrfToken(token);
      
      expect(validateCsrfToken(token, config)).toBe(false);
    });
  });

  describe("generateCsrfTokenForClient", () => {
    it("generates token for client", () => {
      const token = generateCsrfTokenForClient(secret);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
    });
  });

  describe("validateCsrfTokenFromClient", () => {
    it("validates client token", () => {
      const token = generateCsrfTokenForClient(secret);
      
      const result = validateCsrfTokenFromClient(token, secret);
      expect(result).toBe(true);
    });

    it("rejects invalid client token", () => {
      const result = validateCsrfTokenFromClient("invalid", secret);
      expect(result).toBe(false);
    });
  });

  describe("requireCsrfToken", () => {
    it("validates token from header", () => {
      const token = generateCsrfTokenForClient(secret);
      const request = new Request("http://example.com", {
        headers: { "x-csrf-token": token },
      });
      
      const result = requireCsrfToken(request, secret);
      expect(result).toBe(true);
    });

    it("rejects request without token", () => {
      const request = new Request("http://example.com");
      
      const result = requireCsrfToken(request, secret);
      expect(result).toBe(false);
    });

    it("rejects request with invalid token", () => {
      const request = new Request("http://example.com", {
        headers: { "x-csrf-token": "invalid" },
      });
      
      const result = requireCsrfToken(request, secret);
      expect(result).toBe(false);
    });
  });

  describe("addCsrfTokenToHeaders", () => {
    it("adds token to headers", () => {
      const headers = new Headers();
      const token = "test-token";
      
      addCsrfTokenToHeaders(headers, token);
      
      expect(headers.get("x-csrf-token")).toBe(token);
    });
  });

  describe("CSRF_PROTECTED_METHODS", () => {
    it("includes state-changing methods", () => {
      expect(CSRF_PROTECTED_METHODS).toContain("POST");
      expect(CSRF_PROTECTED_METHODS).toContain("PUT");
      expect(CSRF_PROTECTED_METHODS).toContain("PATCH");
      expect(CSRF_PROTECTED_METHODS).toContain("DELETE");
    });
  });

  describe("CSRF_SAFE_METHODS", () => {
    it("includes read-only methods", () => {
      expect(CSRF_SAFE_METHODS).toContain("GET");
      expect(CSRF_SAFE_METHODS).toContain("HEAD");
      expect(CSRF_SAFE_METHODS).toContain("OPTIONS");
    });
  });

  describe("requiresCsrfProtection", () => {
    it("returns true for protected methods", () => {
      expect(requiresCsrfProtection("POST")).toBe(true);
      expect(requiresCsrfProtection("PUT")).toBe(true);
      expect(requiresCsrfProtection("DELETE")).toBe(true);
    });

    it("returns false for safe methods", () => {
      expect(requiresCsrfProtection("GET")).toBe(false);
      expect(requiresCsrfProtection("HEAD")).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(requiresCsrfProtection("post")).toBe(true);
      expect(requiresCsrfProtection("get")).toBe(false);
    });
  });

  describe("isSafeMethod", () => {
    it("returns true for safe methods", () => {
      expect(isSafeMethod("GET")).toBe(true);
      expect(isSafeMethod("HEAD")).toBe(true);
      expect(isSafeMethod("OPTIONS")).toBe(true);
    });

    it("returns false for protected methods", () => {
      expect(isSafeMethod("POST")).toBe(false);
      expect(isSafeMethod("PUT")).toBe(false);
      expect(isSafeMethod("DELETE")).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(isSafeMethod("get")).toBe(true);
      expect(isSafeMethod("post")).toBe(false);
    });
  });
});
