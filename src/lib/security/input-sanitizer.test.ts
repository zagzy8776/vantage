import { describe, it, expect } from "vitest";
import {
  sanitizeString,
  sanitizeEmail,
  isValidEmail,
  sanitizePhone,
  sanitizeUrl,
  sanitizeId,
  sanitizeForSql,
  sanitizeJson,
  sanitizeStringArray,
  sanitizeObject,
  sanitizeNumber,
  sanitizeBoolean,
  sanitizeDate,
  containsXss,
  deepSanitize,
} from "./input-sanitizer";

describe("Input Sanitizer", () => {
  describe("sanitizeString", () => {
    it("removes null bytes", () => {
      const result = sanitizeString("hello\x00world");
      expect(result).toBe("helloworld");
    });

    it("trims whitespace", () => {
      const result = sanitizeString("  hello  ");
      expect(result).toBe("hello");
    });

    it("enforces max length", () => {
      const result = sanitizeString("a".repeat(100), { maxLength: 50 });
      expect(result).toHaveLength(50);
    });

    it("removes HTML by default", () => {
      const result = sanitizeString("<script>alert(1)</script>hello");
      expect(result).toBe("hello");
    });

    it("preserves HTML when allowed", () => {
      const result = sanitizeString("<b>hello</b>", { allowHtml: true });
      expect(result).toBe("<b>hello</b>");
    });

    it("handles HTML entities", () => {
      const result = sanitizeString("hello &amp; world");
      expect(result).toBe("hello & world");
    });
  });

  describe("sanitizeEmail", () => {
    it("lowercases email", () => {
      const result = sanitizeEmail("TEST@EXAMPLE.COM");
      expect(result).toBe("test@example.com");
    });

    it("trims whitespace", () => {
      const result = sanitizeEmail("  test@example.com  ");
      expect(result).toBe("test@example.com");
    });

    it("enforces max length", () => {
      const longEmail = "a".repeat(300) + "@example.com";
      const result = sanitizeEmail(longEmail);
      expect(result.length).toBeLessThanOrEqual(254);
    });
  });

  describe("isValidEmail", () => {
    it("validates correct email", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
    });

    it("rejects invalid email", () => {
      expect(isValidEmail("not-an-email")).toBe(false);
    });

    it("rejects email without @", () => {
      expect(isValidEmail("testexample.com")).toBe(false);
    });

    it("rejects email without domain", () => {
      expect(isValidEmail("test@")).toBe(false);
    });
  });

  describe("sanitizePhone", () => {
    it("keeps digits and special chars", () => {
      const result = sanitizePhone("+1 (555) 123-4567");
      expect(result).toBe("+1 (555) 123-4567");
    });

    it("removes letters", () => {
      const result = sanitizePhone("abc123");
      expect(result).toBe("123");
    });

    it("trims whitespace", () => {
      const result = sanitizePhone("  123  ");
      expect(result).toBe("123");
    });
  });

  describe("sanitizeUrl", () => {
    it("trims whitespace", () => {
      const result = sanitizeUrl("  https://example.com  ");
      expect(result).toBe("https://example.com");
    });

    it("enforces max length", () => {
      const longUrl = "https://example.com/" + "a".repeat(3000);
      const result = sanitizeUrl(longUrl);
      expect(result.length).toBeLessThanOrEqual(2048);
    });
  });

  describe("sanitizeId", () => {
    it("keeps alphanumeric, hyphen, underscore", () => {
      const result = sanitizeId("test-id_123");
      expect(result).toBe("test-id_123");
    });

    it("removes special chars", () => {
      const result = sanitizeId("test@id#123");
      expect(result).toBe("testid123");
    });

    it("trims whitespace", () => {
      const result = sanitizeId("  test-id  ");
      expect(result).toBe("test-id");
    });
  });

  describe("sanitizeForSql", () => {
    it("escapes single quotes", () => {
      const result = sanitizeForSql("test'or'1'='1");
      expect(result).toBe("test''or''1''=''1");
    });

    it("escapes backslashes", () => {
      const result = sanitizeForSql("test\\n");
      expect(result).toBe("test\\\\n");
    });

    it("escapes null bytes", () => {
      const result = sanitizeForSql("test\x00");
      expect(result).toBe("test\\0");
    });
  });

  describe("sanitizeJson", () => {
    it("returns valid JSON", () => {
      const result = sanitizeJson('{"key": "value"}');
      expect(result).toBe('{"key": "value"}');
    });

    it("returns empty object for invalid JSON", () => {
      const result = sanitizeJson('not json');
      expect(result).toBe("{}");
    });
  });

  describe("sanitizeStringArray", () => {
    it("sanitizes array of strings", () => {
      const result = sanitizeStringArray(["  hello  ", "  world  "]);
      expect(result).toEqual(["hello", "world"]);
    });

    it("applies options to all strings", () => {
      const result = sanitizeStringArray(["<b>hello</b>", "<b>world</b>"]);
      expect(result).toEqual(["hello", "world"]);
    });
  });

  describe("sanitizeObject", () => {
    it("sanitizes object string values", () => {
      const result = sanitizeObject({ name: "  hello  ", email: "TEST@EXAMPLE.COM" });
      expect(result).toEqual({ name: "hello", email: "TEST@EXAMPLE.COM" });
    });

    it("sanitizes nested arrays", () => {
      const result = sanitizeObject({ tags: ["  tag1  ", "  tag2  "] });
      expect(result).toEqual({ tags: ["tag1", "tag2"] });
    });

    it("preserves non-string values", () => {
      const result = sanitizeObject({ count: 5, active: true });
      expect(result).toEqual({ count: 5, active: true });
    });
  });

  describe("sanitizeNumber", () => {
    it("parses string to number", () => {
      const result = sanitizeNumber("123");
      expect(result).toBe(123);
    });

    it("returns 0 for invalid", () => {
      const result = sanitizeNumber("not a number");
      expect(result).toBe(0);
    });

    it("enforces min", () => {
      const result = sanitizeNumber(-5, 0);
      expect(result).toBe(0);
    });

    it("enforces max", () => {
      const result = sanitizeNumber(150, 0, 100);
      expect(result).toBe(100);
    });
  });

  describe("sanitizeBoolean", () => {
    it("returns boolean as-is", () => {
      expect(sanitizeBoolean(true)).toBe(true);
      expect(sanitizeBoolean(false)).toBe(false);
    });

    it("parses string true", () => {
      expect(sanitizeBoolean("true")).toBe(true);
      expect(sanitizeBoolean("TRUE")).toBe(true);
    });

    it("parses string false", () => {
      expect(sanitizeBoolean("false")).toBe(false);
    });

    it("parses 1 as true", () => {
      expect(sanitizeBoolean("1")).toBe(true);
    });

    it("parses 0 as false", () => {
      expect(sanitizeBoolean("0")).toBe(false);
    });

    it("parses yes as true", () => {
      expect(sanitizeBoolean("yes")).toBe(true);
    });
  });

  describe("sanitizeDate", () => {
    it("parses valid date", () => {
      const result = sanitizeDate("2024-01-01");
      expect(result).toEqual(new Date("2024-01-01"));
    });

    it("returns null for invalid date", () => {
      const result = sanitizeDate("not a date");
      expect(result).toBeNull();
    });
  });

  describe("containsXss", () => {
    it("detects script tags", () => {
      expect(containsXss("<script>alert(1)</script>")).toBe(true);
    });

    it("detects javascript: protocol", () => {
      expect(containsXss("javascript:alert(1)")).toBe(true);
    });

    it("detects onerror handler", () => {
      expect(containsXss("<img onerror=alert(1)>")).toBe(true);
    });

    it("detects iframe", () => {
      expect(containsXss("<iframe src=evil.com>")).toBe(true);
    });

    it("detects eval", () => {
      expect(containsXss("eval(malicious)")).toBe(true);
    });

    it("allows safe text", () => {
      expect(containsXss("hello world")).toBe(false);
    });
  });

  describe("deepSanitize", () => {
    it("sanitizes nested strings", () => {
      const result = deepSanitize({ nested: { value: "  hello  " } });
      expect(result).toEqual({ nested: { value: "hello" } });
    });

    it("sanitizes arrays", () => {
      const result = deepSanitize(["  hello  ", "  world  "]);
      expect(result).toEqual(["hello", "world"]);
    });

    it("preserves numbers", () => {
      const result = deepSanitize(123);
      expect(result).toBe(123);
    });

    it("preserves booleans", () => {
      const result = deepSanitize(true);
      expect(result).toBe(true);
    });

    it("handles null", () => {
      const result = deepSanitize(null);
      expect(result).toBeNull();
    });
  });
});
