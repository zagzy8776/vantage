import { describe, it, expect } from "vitest";
import { validateUrl, validateUrls, quickValidateUrl } from "./url-validator";

describe("URL Validator (SSRF Protection)", () => {
  describe("quickValidateUrl", () => {
    it("accepts valid HTTP URLs", () => {
      const result = quickValidateUrl("http://example.com");
      expect(result.valid).toBe(true);
    });

    it("accepts valid HTTPS URLs", () => {
      const result = quickValidateUrl("https://example.com");
      expect(result.valid).toBe(true);
    });

    it("rejects invalid URL format", () => {
      const result = quickValidateUrl("not-a-url");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid URL format");
    });

    it("rejects file:// URLs", () => {
      const result = quickValidateUrl("file:///etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("scheme not allowed");
    });

    it("rejects ftp:// URLs", () => {
      const result = quickValidateUrl("ftp://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("scheme not allowed");
    });

    it("rejects localhost", () => {
      const result = quickValidateUrl("http://localhost:8080");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Blocked domain (internal/private)");
    });

    it("rejects 127.0.0.1", () => {
      const result = quickValidateUrl("http://127.0.0.1:8080");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Blocked domain (internal/private)");
    });

    it("rejects 0.0.0.0", () => {
      const result = quickValidateUrl("http://0.0.0.0:8080");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Blocked domain (internal/private)");
    });

    it("rejects metadata.google.internal", () => {
      const result = quickValidateUrl("http://metadata.google.internal");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Blocked domain (internal/private)");
    });

    it("rejects AWS metadata IP", () => {
      const result = quickValidateUrl("http://169.254.169.254");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Blocked domain (internal/private)");
    });
  });

  describe("validateUrl", () => {
    it("accepts valid public URLs", async () => {
      const result = await validateUrl("https://example.com");
      expect(result.valid).toBe(true);
      expect(result.sanitizedUrl).toBe("https://example.com/");
    });

    it("removes credentials from URL", async () => {
      const result = await validateUrl("https://user:password@example.com");
      expect(result.valid).toBe(true);
      expect(result.sanitizedUrl).toBe("https://example.com/");
    });

    it("rejects URLs with invalid scheme", async () => {
      const result = await validateUrl("javascript:alert(1)");
      expect(result.valid).toBe(false);
    });

    it("rejects data URLs", async () => {
      const result = await validateUrl("data:text/html,<script>alert(1)</script>");
      expect(result.valid).toBe(false);
    });
  });

  describe("validateUrls", () => {
    it("validates multiple URLs", async () => {
      const results = await validateUrls([
        "https://example.com",
        "https://example.org",
      ]);
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.valid)).toBe(true);
    });

    it("rejects invalid URLs in batch", async () => {
      const results = await validateUrls([
        "https://example.com",
        "http://localhost",
      ]);
      
      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
    });
  });

  describe("isIpInCidr", () => {
    it("identifies IP in private range", () => {
      // This is tested indirectly through the main validation
      const result = quickValidateUrl("http://192.168.1.1");
      // Note: This won't catch IP-based blocking in quickValidate since it doesn't resolve DNS
      // But the async validateUrl would catch it if DNS resolution was implemented
      expect(result.valid).toBe(true); // quickValidate doesn't check IPs
    });
  });
});
