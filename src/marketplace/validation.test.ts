import { describe, it, expect } from "vitest";
import {
  validateEvidenceSubmission,
  validateEvidenceItem,
  validateSourceItem,
  meetsQualityStandards,
} from "./validation";

describe("Marketplace Validation", () => {
  describe("validateEvidenceSubmission", () => {
    it("validates a complete submission", () => {
      const result = validateEvidenceSubmission(
        [
          {
            statement: "Spa uses Bookify for bookings",
            category: "booking",
            sourceUrl: "https://spa.com",
            confidence: 80,
          },
          {
            statement: "Pricing starts at $50",
            category: "pricing",
            sourceUrl: "https://spa.com/pricing",
            confidence: 90,
          },
          {
            statement: "Open 9am-6pm",
            category: "hours",
            sourceUrl: "https://spa.com",
            confidence: 95,
          },
        ],
        [
          {
            url: "https://spa.com",
            title: "Spa Website",
            type: "website",
          },
          {
            url: "https://spa.com/pricing",
            title: "Pricing Page",
            type: "website",
          },
        ],
        ["Observed booking widget on homepage", "Pricing clearly listed"],
        ["Weekend pricing not visible"],
        "Research conducted on 2024-01-15. Checked homepage and pricing page."
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects submission with no evidence", () => {
      const result = validateEvidenceSubmission(
        [],
        [{ url: "https://test.com", title: "Test", type: "website" }],
        ["Observation"],
        ["Unknown"],
        "Notes"
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("At least one evidence item is required");
    });

    it("rejects submission with no sources", () => {
      const result = validateEvidenceSubmission(
        [{ statement: "Test", category: "booking", sourceUrl: "https://test.com", confidence: 80 }],
        [],
        ["Observation"],
        ["Unknown"],
        "Notes"
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("At least one source is required");
    });

    it("rejects evidence with invalid confidence", () => {
      const result = validateEvidenceSubmission(
        [{ statement: "Test", category: "booking", sourceUrl: "https://test.com", confidence: 150 }],
        [{ url: "https://test.com", title: "Test", type: "website" }],
        ["Observation"],
        ["Unknown"],
        "Notes"
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Evidence item 1: confidence must be between 0 and 100");
    });

    it("warns about AI-generated content", () => {
      const result = validateEvidenceSubmission(
        [{ statement: "Based on the data, the spa uses Bookify", category: "booking", sourceUrl: "https://test.com", confidence: 80 }],
        [{ url: "https://test.com", title: "Test", type: "website" }],
        ["Observation"],
        ["Unknown"],
        "Notes"
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Evidence item 1: statement appears to be AI-generated. Please provide human-verified evidence.");
    });

    it("warns about missing observations", () => {
      const result = validateEvidenceSubmission(
        [{ statement: "Test", category: "booking", sourceUrl: "https://test.com", confidence: 80 }],
        [{ url: "https://test.com", title: "Test", type: "website" }],
        [],
        ["Unknown"],
        "Notes"
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("No observations provided. Adding observations helps verify evidence quality.");
    });

    it("warns about missing unknowns", () => {
      const result = validateEvidenceSubmission(
        [{ statement: "Test", category: "booking", sourceUrl: "https://test.com", confidence: 80 }],
        [{ url: "https://test.com", title: "Test", type: "website" }],
        ["Observation"],
        [],
        "Notes"
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("No unknowns provided. Acknowledging unknowns is important for research integrity.");
    });
  });

  describe("validateEvidenceItem", () => {
    it("validates a correct evidence item", () => {
      const result = validateEvidenceItem({
        statement: "Spa uses Bookify for bookings",
        category: "booking",
        sourceUrl: "https://spa.com",
        confidence: 80,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects evidence with empty statement", () => {
      const result = validateEvidenceItem({
        statement: "",
        category: "booking",
        sourceUrl: "https://spa.com",
        confidence: 80,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Statement is required");
    });

    it("rejects evidence with invalid URL", () => {
      const result = validateEvidenceItem({
        statement: "Test",
        category: "booking",
        sourceUrl: "not-a-url",
        confidence: 80,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Source URL is invalid");
    });

    it("warns about very short statement", () => {
      const result = validateEvidenceItem({
        statement: "Test",
        category: "booking",
        sourceUrl: "https://spa.com",
        confidence: 80,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Statement is very short. Provide more detail.");
    });

    it("warns about very high confidence", () => {
      const result = validateEvidenceItem({
        statement: "Test statement with enough detail",
        category: "booking",
        sourceUrl: "https://spa.com",
        confidence: 95,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Confidence is very high. Ensure this is justified by strong evidence.");
    });
  });

  describe("validateSourceItem", () => {
    it("validates a correct source", () => {
      const result = validateSourceItem({
        url: "https://spa.com",
        title: "Spa Website",
        type: "website",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects source with invalid URL", () => {
      const result = validateSourceItem({
        url: "not-a-url",
        title: "Test",
        type: "website",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("URL is invalid");
    });

    it("rejects source with invalid type", () => {
      const result = validateSourceItem({
        url: "https://spa.com",
        title: "Test",
        type: "invalid" as "website" | "document" | "interview" | "observation" | "other",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid type. Must be one of: website, document, interview, observation, other");
    });
  });

  describe("meetsQualityStandards", () => {
    it("approves submission meeting all standards", () => {
      const result = meetsQualityStandards(3, 2, 1, 1, 100);

      expect(result.meetsStandards).toBe(true);
      expect(result.reason).toBe("Submission meets quality standards");
    });

    it("rejects submission with insufficient evidence", () => {
      const result = meetsQualityStandards(2, 2, 1, 1, 100);

      expect(result.meetsStandards).toBe(false);
      expect(result.reason).toBe("At least 3 evidence items are required");
    });

    it("rejects submission with insufficient sources", () => {
      const result = meetsQualityStandards(3, 1, 1, 1, 100);

      expect(result.meetsStandards).toBe(false);
      expect(result.reason).toBe("At least 2 sources are required");
    });

    it("rejects submission with no observations", () => {
      const result = meetsQualityStandards(3, 2, 0, 1, 100);

      expect(result.meetsStandards).toBe(false);
      expect(result.reason).toBe("At least 1 observation is required");
    });

    it("rejects submission with no unknowns", () => {
      const result = meetsQualityStandards(3, 2, 1, 0, 100);

      expect(result.meetsStandards).toBe(false);
      expect(result.reason).toBe("At least 1 unknown must be acknowledged");
    });

    it("rejects submission with insufficient notes", () => {
      const result = meetsQualityStandards(3, 2, 1, 1, 50);

      expect(result.meetsStandards).toBe(false);
      expect(result.reason).toBe("Notes must be at least 100 characters");
    });
  });
});
