import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  rateLimit,
  getRateLimitKey,
  RATE_LIMITS,
  checkEndpointRateLimit,
  resetRateLimit,
  getRateLimitStatus,
} from "./rate-limiter";

describe("Rate Limiter", () => {
  beforeEach(() => {
    // Clear the store before each test
    // Since we can't access the private store directly, we use a unique identifier
    // for each test to avoid conflicts
  });

  describe("checkRateLimit", () => {
    it("allows requests within limit", () => {
      const config = { windowMs: 60000, maxRequests: 5 };
      const result = checkRateLimit("test-user-1", config);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.limit).toBe(5);
    });

    it("blocks requests over limit", () => {
      const config = { windowMs: 60000, maxRequests: 2 };
      
      checkRateLimit("test-user-2", config);
      checkRateLimit("test-user-2", config);
      const result = checkRateLimit("test-user-2", config);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("resets after window expires", () => {
      const config = { windowMs: 100, maxRequests: 2 };
      
      checkRateLimit("test-user-3", config);
      checkRateLimit("test-user-3", config);
      
      // Wait for window to expire
      return new Promise(resolve => setTimeout(resolve, 150)).then(() => {
        const result = checkRateLimit("test-user-3", config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
      });
    });

    it("tracks separate limits per identifier", () => {
      const config = { windowMs: 60000, maxRequests: 2 };
      
      checkRateLimit("user-a", config);
      checkRateLimit("user-a", config);
      
      const result = checkRateLimit("user-b", config);
      expect(result.allowed).toBe(true);
    });
  });

  describe("rateLimit", () => {
    it("returns a rate limiter function", () => {
      const config = { windowMs: 60000, maxRequests: 10 };
      const limiter = rateLimit(config);
      
      const result = limiter("test-user-4");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
    });
  });

  describe("getRateLimitKey", () => {
    it("creates key from user ID", () => {
      const key = getRateLimitKey(undefined, "user-123");
      expect(key).toBe("user:user-123");
    });

    it("creates key from IP", () => {
      const key = getRateLimitKey("192.168.1.1");
      expect(key).toBe("ip:192.168.1.1");
    });

    it("creates key from user ID and endpoint", () => {
      const key = getRateLimitKey(undefined, "user-123", "/api/investigations");
      expect(key).toBe("user:user-123:/api/investigations");
    });

    it("creates key from IP and endpoint", () => {
      const key = getRateLimitKey("192.168.1.1", undefined, "/api/investigations");
      expect(key).toBe("ip:192.168.1.1:/api/investigations");
    });

    it("prioritizes user ID over IP", () => {
      const key = getRateLimitKey("192.168.1.1", "user-123");
      expect(key).toBe("user:user-123");
    });
  });

  describe("RATE_LIMITS", () => {
    it("has predefined configurations", () => {
      expect(RATE_LIMITS.public).toBeDefined();
      expect(RATE_LIMITS.authenticated).toBeDefined();
      expect(RATE_LIMITS.expensive).toBeDefined();
      expect(RATE_LIMITS.investigationCreate).toBeDefined();
      expect(RATE_LIMITS.marketplaceSubmit).toBeDefined();
      expect(RATE_LIMITS.apiKey).toBeDefined();
    });

    it("public limit is stricter than authenticated", () => {
      expect(RATE_LIMITS.public.maxRequests).toBeLessThan(RATE_LIMITS.authenticated.maxRequests);
    });

    it("expensive operations have strict limits", () => {
      expect(RATE_LIMITS.expensive.maxRequests).toBeLessThan(RATE_LIMITS.authenticated.maxRequests);
    });
  });

  describe("checkEndpointRateLimit", () => {
    it("uses predefined endpoint limits", () => {
      const result = checkEndpointRateLimit("test-user-5", "public");
      expect(result.limit).toBe(RATE_LIMITS.public.maxRequests);
    });

    it("blocks after reaching endpoint limit", () => {
      const identifier = "test-user-6";
      
      // Use investigationCreate which has a low limit
      for (let i = 0; i < RATE_LIMITS.investigationCreate.maxRequests; i++) {
        checkEndpointRateLimit(identifier, "investigationCreate");
      }
      
      const result = checkEndpointRateLimit(identifier, "investigationCreate");
      expect(result.allowed).toBe(false);
    });
  });

  describe("resetRateLimit", () => {
    it("resets rate limit for identifier", () => {
      const config = { windowMs: 60000, maxRequests: 2 };
      const identifier = "test-user-7";
      
      checkRateLimit(identifier, config);
      checkRateLimit(identifier, config);
      
      let result = checkRateLimit(identifier, config);
      expect(result.allowed).toBe(false);
      
      resetRateLimit(identifier);
      
      result = checkRateLimit(identifier, config);
      expect(result.allowed).toBe(true);
    });
  });

  describe("getRateLimitStatus", () => {
    it("returns null for unknown identifier", () => {
      const result = getRateLimitStatus("unknown-user");
      expect(result).toBeNull();
    });

    it("returns status for known identifier", () => {
      const config = { windowMs: 60000, maxRequests: 10 };
      const identifier = "test-user-8";
      
      checkRateLimit(identifier, config);
      
      const result = getRateLimitStatus(identifier);
      expect(result).not.toBeNull();
      expect(result?.allowed).toBe(true);
    });
  });
});
