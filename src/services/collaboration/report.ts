/**
 * Milestone 12: Collaboration, Reports & Exports
 * 
 * Report generation service with evidence hierarchy preservation.
 */

import { newId } from "@/lib/ids";
import type {
  InvestigationReport,
  ReportSection,
  ExportFormat,
  ExportResult,
} from "./types";

/**
 * Evidence hierarchy levels for proper attribution
 */
export type EvidenceLevel = "fact" | "finding";

/**
 * Evidence item with hierarchy context
 */
export interface EvidenceItem {
  id: string;
  statement: string;
  category: string;
  sourceUrl: string;
  level: EvidenceLevel;
  confidence: number;
  businessId?: string;
  businessName?: string;
}

/**
 * Finding with evidence attribution
 */
export interface FindingItem {
  id: string;
  title: string;
  description: string;
  evidenceCount: number;
  evidenceIds: string[];
  level: EvidenceLevel;
}

/**
 * Opportunity with evidence attribution
 */
export interface OpportunityItem {
  id: string;
  hypothesis: string;
  priority: string;
  evidenceCount: number;
  evidenceIds: string[];
  unknowns: string[];
}

/**
 * Report data structure
 */
export interface ReportData {
  investigationId: string;
  investigationTitle: string;
  investigationObjective: string;
  executiveSummary: string;
  findings: FindingItem[];
  evidence: EvidenceItem[];
  opportunities: OpportunityItem[];
  recommendedActions: string[];
  generatedBy: string;
  generatedByName: string;
}

/**
 * Generate a report from investigation data
 */
export function generateReport(data: ReportData): InvestigationReport {
  const sections: ReportSection[] = [
    {
      id: newId(),
      title: "Executive Summary",
      content: data.executiveSummary,
      order: 1,
    },
    {
      id: newId(),
      title: "Investigation Objective",
      content: data.investigationObjective,
      order: 2,
    },
    {
      id: newId(),
      title: "Findings",
      content: generateFindingsSection(data.findings, data.evidence),
      order: 3,
    },
    {
      id: newId(),
      title: "Evidence",
      content: generateEvidenceSection(data.evidence),
      order: 4,
    },
    {
      id: newId(),
      title: "Opportunities",
      content: generateOpportunitiesSection(data.opportunities),
      order: 5,
    },
    {
      id: newId(),
      title: "Recommended Actions",
      content: generateActionsSection(data.recommendedActions),
      order: 6,
    },
  ];

  return {
    id: newId(),
    investigationId: data.investigationId,
    title: `${data.investigationTitle} - Report`,
    status: "ready",
    generatedBy: data.generatedBy,
    generatedByName: data.generatedByName,
    createdAt: new Date(),
    generatedAt: new Date(),
    sections,
    metadata: {
      executiveSummary: data.executiveSummary,
      totalFindings: data.findings.length,
      totalEvidence: data.evidence.length,
      totalOpportunities: data.opportunities.length,
      totalUnknowns: data.opportunities.reduce((sum, opp) => sum + opp.unknowns.length, 0),
      recommendedActions: data.recommendedActions,
    },
  };
}

/**
 * Generate findings section with evidence hierarchy
 */
function generateFindingsSection(findings: FindingItem[], evidence: EvidenceItem[]): string {
  if (findings.length === 0) {
    return "No findings generated.";
  }

  const lines: string[] = [];
  
  for (const finding of findings) {
    lines.push(`### ${finding.title}`);
    lines.push(finding.description);
    lines.push(`**Evidence Level:** ${finding.level}`);
    lines.push(`**Supporting Evidence:** ${finding.evidenceCount} item(s)`);
    
    // List evidence IDs for attribution
    if (finding.evidenceIds.length > 0) {
      lines.push("**Evidence References:**");
      for (const evidenceId of finding.evidenceIds) {
        const ev = evidence.find(e => e.id === evidenceId);
        if (ev) {
          lines.push(`- ${ev.statement} (${ev.level}, confidence: ${ev.confidence}%)`);
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate evidence section with hierarchy preservation
 */
function generateEvidenceSection(evidence: EvidenceItem[]): string {
  if (evidence.length === 0) {
    return "No evidence collected.";
  }

  const lines: string[] = [];
  lines.push("Evidence is categorized by confidence level and attribution:");
  lines.push("");

  // Group by level
  const facts = evidence.filter(e => e.level === "fact");
  const findings = evidence.filter(e => e.level === "finding");

  if (facts.length > 0) {
    lines.push("### Facts (Directly Observed)");
    for (const item of facts) {
      lines.push(`- ${item.statement}`);
      lines.push(`  - Category: ${item.category}`);
      lines.push(`  - Confidence: ${item.confidence}%`);
      lines.push(`  - Source: ${item.sourceUrl}`);
      if (item.businessName) {
        lines.push(`  - Business: ${item.businessName}`);
      }
      lines.push("");
    }
  }

  if (findings.length > 0) {
    lines.push("### Findings (Derived from Evidence)");
    for (const item of findings) {
      lines.push(`- ${item.statement}`);
      lines.push(`  - Category: ${item.category}`);
      lines.push(`  - Confidence: ${item.confidence}%`);
      lines.push(`  - Source: ${item.sourceUrl}`);
      if (item.businessName) {
        lines.push(`  - Business: ${item.businessName}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Generate opportunities section
 */
function generateOpportunitiesSection(opportunities: OpportunityItem[]): string {
  if (opportunities.length === 0) {
    return "No opportunities identified.";
  }

  const lines: string[] = [];

  for (const opp of opportunities) {
    lines.push(`### ${opp.hypothesis}`);
    lines.push(`**Priority:** ${opp.priority}`);
    lines.push(`**Supporting Evidence:** ${opp.evidenceCount} item(s)`);
    
    if (opp.unknowns.length > 0) {
      lines.push("**Unknowns:**");
      for (const unknown of opp.unknowns) {
        lines.push(`- ${unknown}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate recommended actions section
 */
function generateActionsSection(actions: string[]): string {
  if (actions.length === 0) {
    return "No recommended actions.";
  }

  const lines: string[] = [];
  lines.push("Recommended next steps:");
  lines.push("");

  for (let i = 0; i < actions.length; i++) {
    lines.push(`${i + 1}. ${actions[i]}`);
  }

  return lines.join("\n");
}

/**
 * Export report to JSON
 */
export function exportToJSON(report: InvestigationReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Export report to CSV
 */
export function exportToCSV(report: InvestigationReport): string {
  const lines: string[] = [];
  
  // Header
  lines.push("Section,Content");
  
  // Sections
  for (const section of report.sections) {
    const content = section.content.replace(/"/g, '""').replace(/\n/g, " ");
    lines.push(`"${section.title}","${content}"`);
  }
  
  // Metadata
  lines.push("");
  lines.push("Metadata");
  lines.push(`Total Findings,${report.metadata.totalFindings}`);
  lines.push(`Total Evidence,${report.metadata.totalEvidence}`);
  lines.push(`Total Opportunities,${report.metadata.totalOpportunities}`);
  lines.push(`Total Unknowns,${report.metadata.totalUnknowns}`);
  
  return lines.join("\n");
}

/**
 * Export report to PDF (placeholder - would use PDF library)
 */
export function exportToPDF(report: InvestigationReport): string {
  // In production, this would use a PDF generation library like jsPDF or puppeteer
  // For now, return a formatted text representation
  const lines: string[] = [];
  
  lines.push(report.title);
  lines.push("=".repeat(report.title.length));
  lines.push("");
  lines.push(`Generated: ${report.generatedAt?.toISOString() || new Date().toISOString()}`);
  lines.push(`Generated by: ${report.generatedByName}`);
  lines.push("");
  
  for (const section of report.sections) {
    lines.push(section.title);
    lines.push("-".repeat(section.title.length));
    lines.push(section.content);
    lines.push("");
  }
  
  lines.push("Metadata");
  lines.push("-".repeat(8));
  lines.push(`Total Findings: ${report.metadata.totalFindings}`);
  lines.push(`Total Evidence: ${report.metadata.totalEvidence}`);
  lines.push(`Total Opportunities: ${report.metadata.totalOpportunities}`);
  lines.push(`Total Unknowns: ${report.metadata.totalUnknowns}`);
  
  return lines.join("\n");
}

/**
 * Export report in specified format
 */
export function exportReport(
  report: InvestigationReport,
  format: ExportFormat
): ExportResult {
  let content: string;
  let filename: string;
  
  switch (format) {
    case "json":
      content = exportToJSON(report);
      filename = `${report.title.replace(/\s+/g, "_")}.json`;
      break;
    case "csv":
      content = exportToCSV(report);
      filename = `${report.title.replace(/\s+/g, "_")}.csv`;
      break;
    case "pdf":
      content = exportToPDF(report);
      filename = `${report.title.replace(/\s+/g, "_")}.txt`; // Placeholder for PDF
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  // In production, this would upload to storage and return a URL
  // For now, return a mock result
  return {
    reportId: report.id,
    format,
    url: `https://storage.example.com/reports/${filename}`,
    filename,
    size: content.length,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  };
}
