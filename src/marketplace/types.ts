/**
 * Milestone 13: Researcher Marketplace
 * 
 * Types for the researcher marketplace - clearly separated from core investigation architecture.
 */

export type TaskStatus = "draft" | "open" | "assigned" | "in_progress" | "completed" | "cancelled";
export type ApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";
export type SubmissionStatus = "pending" | "under_review" | "approved" | "rejected" | "needs_revision";
export type PaymentStatus = "pending" | "processing" | "paid" | "failed";

/**
 * Research task posted by investigation owner
 */
export interface ResearchTask {
  id: string;
  investigationId: string;
  investigationTitle: string;
  postedBy: string;
  postedByName: string;
  title: string;
  description: string;
  requirements: string[];
  budget: number;
  currency: string;
  status: TaskStatus;
  deadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedAt: Date | null;
}

/**
 * Researcher application for a task
 */
export interface TaskApplication {
  id: string;
  taskId: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  coverLetter: string;
  qualifications: string[];
  proposedTimeline: string;
  status: ApplicationStatus;
  appliedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

/**
 * Evidence submission from researcher
 */
export interface EvidenceSubmission {
  id: string;
  taskId: string;
  submittedBy: string;
  submittedByName: string;
  status: SubmissionStatus;
  evidence: EvidenceItem[];
  sources: SourceItem[];
  observations: string[];
  unknowns: string[];
  notes: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

/**
 * Evidence item submitted by researcher
 */
export interface EvidenceItem {
  id: string;
  statement: string;
  category: string;
  sourceUrl: string;
  businessId?: string;
  businessName?: string;
  confidence: number;
}

/**
 * Source item for evidence
 */
export interface SourceItem {
  id: string;
  url: string;
  title: string;
  type: "website" | "document" | "interview" | "observation" | "other";
  accessedAt: Date;
}

/**
 * Payment record
 */
export interface Payment {
  id: string;
  taskId: string;
  submissionId: string;
  paidTo: string;
  paidToName: string;
  paidBy: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  processedAt: Date | null;
  transactionId: string | null;
}

/**
 * Researcher profile
 */
export interface ResearcherProfile {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  bio: string;
  skills: string[];
  completedTasks: number;
  rating: number;
  totalReviews: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
