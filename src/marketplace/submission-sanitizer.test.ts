import { describe, it, expect } from "vitest";
import {
  sanitizeTaskApplication,
  sanitizeTaskSubmission,
  validateMarketplaceUrl,
  sanitizeMarketplaceSources,
  sanitizeMarketplaceData,
  isSafeForDisplay,
  escapeHtml,
  escapeJavaScript,
  escapeUrl,
  validateTaskDescription,
  sanitizeTaskDescription,
} from "./submission-sanitizer";

describe("Marketplace Submission Sanitizer", () => {
  describe("sanitizeTaskApplication", () => {
    it("sanitizes cover letter", () => {
      const input = {
        taskId: "task-1",
        coverLetter: "  Hello world  ",
        qualifications: ["Skill 1"],
        proposedTimeline: "1 week",
      };

      const result = sanitizeTaskApplication(input);
      expect(result.coverLetter).toBe("Hello world");
    });

    it("removes HTML from cover letter", () => {
      const input = {
        taskId: "task-1",
        coverLetter: "<b>Hello</b>",
        qualifications: ["Skill 1"],
        proposedTimeline: "1 week",
      };

      const result = sanitizeTaskApplication(input);
      expect(result.coverLetter).toBe("Hello");
    });

    it("throws on XSS in cover letter", () => {
      const input = {
        taskId: "task-1",
        coverLetter: "<script>alert(1)</script>",
        qualifications: ["Skill 1"],
        proposedTimeline: "1 week",
      };

      expect(() => sanitizeTaskApplication(input)).toThrow("potentially malicious content");
    });

    it("sanitizes qualifications", () => {
      const input = {
        taskId: "task-1",
        coverLetter: "Hello",
        qualifications: ["  Skill 1  ", "  Skill 2  "],
        proposedTimeline: "1 week",
      };

      const result = sanitizeTaskApplication(input);
      expect(result.qualifications).toEqual(["Skill 1", "Skill 2"]);
    });

    it("throws on XSS in qualifications", () => {
      const input = {
        taskId: "task-1",
        coverLetter: "Hello",
        qualifications: ["<script>alert(1)</script>"],
        proposedTimeline: "1 week",
      };

      expect(() => sanitizeTaskApplication(input)).toThrow("potentially malicious content");
    });

    it("sanitizes proposed timeline", () => {
      const input = {
        taskId: "task-1",
        coverLetter: "Hello",
        qualifications: ["Skill 1"],
        proposedTimeline: "  1 week  ",
      };

      const result = sanitizeTaskApplication(input);
      expect(result.proposedTimeline).toBe("1 week");
    });
  });

  describe("sanitizeTaskSubmission", () => {
    it("sanitizes evidence", () => {
      const input = {
        taskId: "task-1",
        applicationId: "app-1",
        evidence: "  Evidence text  ",
        findings: "Findings",
        sources: ["https://example.com"],
      };

      const result = sanitizeTaskSubmission(input);
      expect(result.evidence).toBe("Evidence text");
    });

    it("removes HTML from evidence", () => {
      const input = {
        taskId: "task-1",
        applicationId: "app-1",
        evidence: "<b>Evidence</b>",
        findings: "Findings",
        sources: ["https://example.com"],
      };

      const result = sanitizeTaskSubmission(input);
      expect(result.evidence).toBe("Evidence");
    });

    it("throws on XSS in evidence", () => {
      const input = {
        taskId: "task-1",
        applicationId: "app-1",
        evidence: "<script>alert(1)</script>",
        findings: "Findings",
        sources: ["https://example.com"],
      };

      expect(() => sanitizeTaskSubmission(input)).toThrow("potentially malicious content");
    });

    it("sanitizes findings", () => {
      const input = {
        taskId: "task-1",
        applicationId: "app-1",
        evidence: "Evidence",
        findings: "  Findings text  ",
        sources: ["https://example.com"],
      };

      const result = sanitizeTaskSubmission(input);
      expect(result.findings).toBe("Findings text");
    });

    it("throws on XSS in findings", () => {
      const input = {
        taskId: "task-1",
        applicationId: "app-1",
        evidence: "Evidence",
        findings: "<script>alert(1)</script>",
        sources: ["https://example.com"],
      };

      expect(() => sanitizeTaskSubmission(input)).toThrow("potentially malicious content");
    });

    it("sanitizes source URLs", () => {
      const input = {
        taskId: "task-1",
        applicationId: "app-1",
        evidence: "Evidence",
        findings: "Findings",
        sources: ["  https://example.com  "],
      };

      const result = sanitizeTaskSubmission(input);
      expect(result.sources).toEqual(["https://example.com"]);
    });
  });

  describe("validateMarketplaceUrl", () => {
    it("accepts valid HTTP URL", () => {
      const result = validateMarketplaceUrl("http://example.com");
      expect(result.valid).toBe(true);
    });

    it("accepts valid HTTPS URL", () => {
      const result = validateMarketplaceUrl("https://example.com");
      expect(result.valid).toBe(true);
    });

    it("rejects non-HTTP URL", () => {
      const result = validateMarketplaceUrl("ftp://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTP or HTTPS");
    });

    it("rejects URL with XSS", () => {
      const result = validateMarketplaceUrl("javascript:alert(1)");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("malicious");
    });

    it("rejects invalid URL", () => {
      const result = validateMarketplaceUrl("not-a-url");
      expect(result.valid).toBe(false);
    });
  });

  describe("sanitizeMarketplaceSources", () => {
    it("sanitizes array of URLs", () => {
      const result = sanitizeMarketplaceSources([
        "https://example.com",
        "https://example.org",
      ]);
      expect(result).toHaveLength(2);
    });

    it("throws on invalid URL", () => {
      expect(() =>
        sanitizeMarketplaceSources(["javascript:alert(1)"])
      ).toThrow("Invalid source URL");
    });
  });

  describe("sanitizeMarketplaceData", () => {
    it("sanitizes nested object", () => {
      const data = {
        nested: {
          value: "  hello  ",
        },
      };

      const result = sanitizeMarketplaceData(data);
      expect(result).toEqual({ nested: { value: "hello" } });
    });

    it("sanitizes array", () => {
      const data = ["  hello  ", "  world  "];
      const result = sanitizeMarketplaceData(data);
      expect(result).toEqual(["hello", "world"]);
    });
  });

  describe("isSafeForDisplay", () => {
    it("returns true for safe text", () => {
      expect(isSafeForDisplay("Hello world")).toBe(true);
    });

    it("returns false for XSS", () => {
      expect(isSafeForDisplay("<script>alert(1)</script>")).toBe(false);
    });

    it("returns false for javascript: protocol", () => {
      expect(isSafeForDisplay("javascript:alert(1)")).toBe(false);
    });
  });

  describe("escapeHtml", () => {
    it("escapes HTML entities", () => {
      const result = escapeHtml("<script>alert(1)</script>");
      expect(result).toBe("&lt;script&gt;alert(1)&lt;&#x2F;script&gt;");
    });

    it("escapes ampersand", () => {
      const result = escapeHtml("A & B");
      expect(result).toBe("A &amp; B");
    });

    it("escapes quotes", () => {
      const result = escapeHtml('"test"');
      expect(result).toBe("&quot;test&quot;");
    });

    it("escapes forward slash", () => {
      const result = escapeHtml("<script/>");
      expect(result).toContain("&#x2F;");
    });
  });

  describe("escapeJavaScript", () => {
    it("escapes backslashes", () => {
      const result = escapeJavaScript("test\\n");
      expect(result).toBe("test\\\\n");
    });

    it("escapes quotes", () => {
      const result = escapeJavaScript("test's");
      expect(result).toBe("test\\'s");
    });

    it("escapes newlines", () => {
      const result = escapeJavaScript("test\n");
      expect(result).toBe("test\\n");
    });
  });

  describe("escapeUrl", () => {
    it("encodes URL", () => {
      const result = escapeUrl("hello world");
      expect(result).toBe("hello%20world");
    });

    it("encodes special characters", () => {
      const result = escapeUrl("test@example.com");
      expect(result).toContain("%40");
    });
  });

  describe("validateTaskDescription", () => {
    it("accepts valid description", () => {
      const result = validateTaskDescription("Valid description");
      expect(result.valid).toBe(true);
    });

    it("rejects too long description", () => {
      const longDesc = "a".repeat(10001);
      const result = validateTaskDescription(longDesc);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too long");
    });

    it("rejects XSS in description", () => {
      const result = validateTaskDescription("<script>alert(1)</script>");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("malicious");
    });
  });

  describe("sanitizeTaskDescription", () => {
    it("sanitizes description", () => {
      const result = sanitizeTaskDescription("  Hello world  ");
      expect(result).toBe("Hello world");
    });

    it("removes HTML", () => {
      const result = sanitizeTaskDescription("<b>Hello</b>");
      expect(result).toBe("Hello");
    });

    it("throws on too long description", () => {
      const longDesc = "a".repeat(10001);
      expect(() => sanitizeTaskDescription(longDesc)).toThrow("too long");
    });

    it("throws on XSS", () => {
      expect(() =>
        sanitizeTaskDescription("<script>alert(1)</script>")
      ).toThrow("malicious");
    });
  });
});
