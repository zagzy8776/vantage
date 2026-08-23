/**
 * Milestone 12: Collaboration, Reports & Exports
 * 
 * Types for investigation collaboration, reporting, and exporting.
 */

export type MemberRole = "owner" | "admin" | "editor" | "viewer" | "reviewer";
export type AssignmentStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type NoteType = "general" | "evidence" | "finding" | "opportunity" | "task";
export type ReviewStatus = "pending" | "approved" | "rejected" | "needs_changes";
export type ExportFormat = "pdf" | "csv" | "json";
export type ReportStatus = "draft" | "generating" | "ready" | "failed";

/**
 * Investigation member
 */
export interface InvestigationMember {
  id: string;
  investigationId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: MemberRole;
  joinedAt: Date;
}

/**
 * Investigation note
 */
export interface InvestigationNote {
  id: string;
  investigationId: string;
  authorId: string;
  authorName: string;
  type: NoteType;
  targetId?: string; // ID of evidence, finding, opportunity, or task
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task assignment
 */
export interface TaskAssignment {
  id: string;
  investigationId: string;
  assignedTo: string;
  assignedToName: string;
  assignedBy: string;
  assignedByName: string;
  title: string;
  description: string;
  status: AssignmentStatus;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

/**
 * Review request
 */
export interface ReviewRequest {
  id: string;
  investigationId: string;
  requestedBy: string;
  requestedByName: string;
  requestedFrom: string;
  requestedFromName: string;
  status: ReviewStatus;
  notes: string;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewNotes: string | null;
}

/**
 * Report section
 */
export interface ReportSection {
  id: string;
  title: string;
  content: string;
  order: number;
}

/**
 * Investigation report
 */
export interface InvestigationReport {
  id: string;
  investigationId: string;
  title: string;
  status: ReportStatus;
  generatedBy: string;
  generatedByName: string;
  createdAt: Date;
  generatedAt: Date | null;
  sections: ReportSection[];
  metadata: {
    executiveSummary: string;
    totalFindings: number;
    totalEvidence: number;
    totalOpportunities: number;
    totalUnknowns: number;
    recommendedActions: string[];
  };
}

/**
 * Export result
 */
export interface ExportResult {
  reportId: string;
  format: ExportFormat;
  url: string;
  filename: string;
  size: number;
  createdAt: Date;
  expiresAt: Date;
}
