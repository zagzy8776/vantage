import { describe, it, expect } from "vitest";
import {
  generateReport,
  exportToJSON,
  exportToCSV,
  exportToPDF,
  exportReport,
} from "./report";

describe("Report Generation", () => {
  describe("generateReport", () => {
    it("generates a report with all sections", () => {
      const data = {
        investigationId: "inv1",
        investigationTitle: "Test Investigation",
        investigationObjective: "Test objective",
        executiveSummary: "This is a test summary",
        findings: [
          {
            id: "f1",
            title: "Finding 1",
            description: "Description 1",
            evidenceCount: 2,
            evidenceIds: ["e1", "e2"],
            level: "finding" as const,
          },
        ],
        evidence: [
          {
            id: "e1",
            statement: "Evidence 1",
            category: "booking",
            sourceUrl: "https://example.com",
            level: "fact" as const,
            confidence: 80,
          },
          {
            id: "e2",
            statement: "Evidence 2",
            category: "pricing",
            sourceUrl: "https://example.com",
            level: "finding" as const,
            confidence: 60,
          },
        ],
        opportunities: [
          {
            id: "o1",
            hypothesis: "Opportunity 1",
            priority: "high",
            evidenceCount: 1,
            evidenceIds: ["e1"],
            unknowns: ["Unknown 1"],
          },
        ],
        recommendedActions: ["Action 1", "Action 2"],
        generatedBy: "user1",
        generatedByName: "John Doe",
      };

      const report = generateReport(data);

      expect(report.investigationId).toBe("inv1");
      expect(report.title).toBe("Test Investigation - Report");
      expect(report.status).toBe("ready");
      expect(report.sections).toHaveLength(6);
      expect(report.metadata.totalFindings).toBe(1);
      expect(report.metadata.totalEvidence).toBe(2);
      expect(report.metadata.totalOpportunities).toBe(1);
      expect(report.metadata.totalUnknowns).toBe(1);
      expect(report.metadata.recommendedActions).toEqual(["Action 1", "Action 2"]);
    });

    it("generates report with empty data", () => {
      const data = {
        investigationId: "inv1",
        investigationTitle: "Test",
        investigationObjective: "",
        executiveSummary: "Summary",
        findings: [],
        evidence: [],
        opportunities: [],
        recommendedActions: [],
        generatedBy: "user1",
        generatedByName: "John",
      };

      const report = generateReport(data);

      expect(report.metadata.totalFindings).toBe(0);
      expect(report.metadata.totalEvidence).toBe(0);
      expect(report.metadata.totalOpportunities).toBe(0);
      expect(report.metadata.totalUnknowns).toBe(0);
    });
  });

  describe("exportToJSON", () => {
    it("exports report to JSON", () => {
      const report = {
        id: "r1",
        investigationId: "inv1",
        title: "Test Report",
        status: "ready" as const,
        generatedBy: "user1",
        generatedByName: "John",
        createdAt: new Date(),
        generatedAt: new Date(),
        sections: [],
        metadata: {
          executiveSummary: "Summary",
          totalFindings: 1,
          totalEvidence: 2,
          totalOpportunities: 1,
          totalUnknowns: 0,
          recommendedActions: [],
        },
      };

      const json = exportToJSON(report);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe("r1");
      expect(parsed.title).toBe("Test Report");
    });
  });

  describe("exportToCSV", () => {
    it("exports report to CSV", () => {
      const report = {
        id: "r1",
        investigationId: "inv1",
        title: "Test Report",
        status: "ready" as const,
        generatedBy: "user1",
        generatedByName: "John",
        createdAt: new Date(),
        generatedAt: new Date(),
        sections: [
          {
            id: "s1",
            title: "Executive Summary",
            content: "Test summary",
            order: 1,
          },
        ],
        metadata: {
          executiveSummary: "Summary",
          totalFindings: 1,
          totalEvidence: 2,
          totalOpportunities: 1,
          totalUnknowns: 0,
          recommendedActions: [],
        },
      };

      const csv = exportToCSV(report);

      expect(csv).toContain("Section,Content");
      expect(csv).toContain("Executive Summary");
      expect(csv).toContain("Total Findings,1");
    });
  });

  describe("exportToPDF", () => {
    it("exports report to PDF (text placeholder)", () => {
      const report = {
        id: "r1",
        investigationId: "inv1",
        title: "Test Report",
        status: "ready" as const,
        generatedBy: "user1",
        generatedByName: "John",
        createdAt: new Date(),
        generatedAt: new Date(),
        sections: [
          {
            id: "s1",
            title: "Executive Summary",
            content: "Test summary",
            order: 1,
          },
        ],
        metadata: {
          executiveSummary: "Summary",
          totalFindings: 1,
          totalEvidence: 2,
          totalOpportunities: 1,
          totalUnknowns: 0,
          recommendedActions: [],
        },
      };

      const pdf = exportToPDF(report);

      expect(pdf).toContain("Test Report");
      expect(pdf).toContain("Executive Summary");
      expect(pdf).toContain("Total Findings: 1");
    });
  });

  describe("exportReport", () => {
    it("exports report in JSON format", () => {
      const report = {
        id: "r1",
        investigationId: "inv1",
        title: "Test Report",
        status: "ready" as const,
        generatedBy: "user1",
        generatedByName: "John",
        createdAt: new Date(),
        generatedAt: new Date(),
        sections: [],
        metadata: {
          executiveSummary: "Summary",
          totalFindings: 1,
          totalEvidence: 2,
          totalOpportunities: 1,
          totalUnknowns: 0,
          recommendedActions: [],
        },
      };

      const result = exportReport(report, "json");

      expect(result.reportId).toBe("r1");
      expect(result.format).toBe("json");
      expect(result.filename).toContain(".json");
      expect(result.url).toContain("storage.example.com");
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("exports report in CSV format", () => {
      const report = {
        id: "r1",
        investigationId: "inv1",
        title: "Test Report",
        status: "ready" as const,
        generatedBy: "user1",
        generatedByName: "John",
        createdAt: new Date(),
        generatedAt: new Date(),
        sections: [],
        metadata: {
          executiveSummary: "Summary",
          totalFindings: 1,
          totalEvidence: 2,
          totalOpportunities: 1,
          totalUnknowns: 0,
          recommendedActions: [],
        },
      };

      const result = exportReport(report, "csv");

      expect(result.format).toBe("csv");
      expect(result.filename).toContain(".csv");
    });

    it("throws error for unsupported format", () => {
      const report = {
        id: "r1",
        investigationId: "inv1",
        title: "Test Report",
        status: "ready" as const,
        generatedBy: "user1",
        generatedByName: "John",
        createdAt: new Date(),
        generatedAt: new Date(),
        sections: [],
        metadata: {
          executiveSummary: "Summary",
          totalFindings: 1,
          totalEvidence: 2,
          totalOpportunities: 1,
          totalUnknowns: 0,
          recommendedActions: [],
        },
      };

      expect(() => exportReport(report, "docx" as "json" | "csv" | "pdf")).toThrow("Unsupported export format");
    });
  });
});
