/**
 * Milestone 13: Researcher Marketplace
 * 
 * Human review workflow for researcher submissions - ensures quality control
 * and maintains VANTAGE's evidence/trust model.
 */

import { updateSubmissionStatus } from "./service";
import { validateEvidenceSubmission, meetsQualityStandards } from "./validation";
import type { EvidenceSubmission, SubmissionStatus } from "./types";

/**
 * Review result
 */
export interface ReviewResult {
  approved: boolean;
  status: SubmissionStatus;
  notes: string;
  evidenceToAccept: string[];
  evidenceToReject: string[];
}

/**
 * Review a submission
 */
export function reviewSubmission(
  submission: EvidenceSubmission,
  reviewerId: string,
  reviewNotes: string,
  decision: "approve" | "reject" | "request_revision"
): ReviewResult {
  const evidenceToAccept: string[] = [];
  const evidenceToReject: string[] = [];

  // Validate submission
  const validation = validateEvidenceSubmission(
    submission.evidence,
    submission.sources,
    submission.observations,
    submission.unknowns,
    submission.notes
  );

  // Check quality standards
  const qualityCheck = meetsQualityStandards(
    submission.evidence.length,
    submission.sources.length,
    submission.observations.length,
    submission.unknowns.length,
    submission.notes.length
  );

  // If requesting revision, always return needs_revision
  if (decision === "request_revision") {
    return {
      approved: false,
      status: "needs_revision",
      notes: reviewNotes || validation.errors.join("; ") + " " + validation.warnings.join("; "),
      evidenceToAccept: [],
      evidenceToReject: [],
    };
  }

  // If rejecting, return rejected
  if (decision === "reject") {
    return {
      approved: false,
      status: "rejected",
      notes: reviewNotes || "Submission does not meet quality standards",
      evidenceToAccept: [],
      evidenceToReject: submission.evidence.map(e => e.id),
    };
  }

  // If approving, check validation and quality
  if (!validation.valid) {
    return {
      approved: false,
      status: "needs_revision",
      notes: `Validation errors: ${validation.errors.join("; ")}`,
      evidenceToAccept: [],
      evidenceToReject: [],
    };
  }

  if (!qualityCheck.meetsStandards) {
    return {
      approved: false,
      status: "needs_revision",
      notes: qualityCheck.reason,
      evidenceToAccept: [],
      evidenceToReject: [],
    };
  }

  // Approve with selective evidence acceptance
  for (const evidence of submission.evidence) {
    if (evidence.confidence >= 50) {
      evidenceToAccept.push(evidence.id);
    } else {
      evidenceToReject.push(evidence.id);
    }
  }

  return {
    approved: true,
    status: "approved",
    notes: reviewNotes || "Submission approved",
    evidenceToAccept,
    evidenceToReject,
  };
}

/**
 * Get pending submissions for review
 */
export function getPendingSubmissions(submissions: EvidenceSubmission[]): EvidenceSubmission[] {
  return submissions.filter(s => s.status === "pending" || s.status === "under_review");
}

/**
 * Get submissions by status
 */
export function getSubmissionsByStatus(
  submissions: EvidenceSubmission[],
  status: SubmissionStatus
): EvidenceSubmission[] {
  return submissions.filter(s => s.status === status);
}

/**
 * Get submissions for a reviewer
 */
export function getSubmissionsForReviewer(
  submissions: EvidenceSubmission[],
  reviewerId: string
): EvidenceSubmission[] {
  return submissions.filter(s => s.reviewedBy === reviewerId);
}

/**
 * Get submission statistics
 */
export function getSubmissionStatistics(submissions: EvidenceSubmission[]) {
  const total = submissions.length;
  const pending = submissions.filter(s => s.status === "pending").length;
  const underReview = submissions.filter(s => s.status === "under_review").length;
  const approved = submissions.filter(s => s.status === "approved").length;
  const rejected = submissions.filter(s => s.status === "rejected").length;
  const needsRevision = submissions.filter(s => s.status === "needs_revision").length;

  return {
    total,
    pending,
    underReview,
    approved,
    rejected,
    needsRevision,
    approvalRate: total > 0 ? (approved / total) * 100 : 0,
  };
}

/**
 * Check if submission requires human review
 */
export function requiresReview(submission: EvidenceSubmission): boolean {
  return submission.status === "pending" || submission.status === "under_review";
}

/**
 * Mark submission for review
 */
export function markForReview(submission: EvidenceSubmission): EvidenceSubmission {
  return updateSubmissionStatus(submission, "under_review", "system", "Marked for human review");
}

/**
 * Auto-reject low-quality submissions
 */
export function autoRejectLowQuality(submission: EvidenceSubmission): EvidenceSubmission | null {
  const qualityCheck = meetsQualityStandards(
    submission.evidence.length,
    submission.sources.length,
    submission.observations.length,
    submission.unknowns.length,
    submission.notes.length
  );

  if (!qualityCheck.meetsStandards) {
    return updateSubmissionStatus(
      submission,
      "rejected",
      "system",
      `Auto-rejected: ${qualityCheck.reason}`
    );
  }

  return null;
}

/**
 * Get evidence quality summary
 */
export function getEvidenceQualitySummary(submission: EvidenceSubmission) {
  const highConfidence = submission.evidence.filter(e => e.confidence >= 75).length;
  const mediumConfidence = submission.evidence.filter(e => e.confidence >= 50 && e.confidence < 75).length;
  const lowConfidence = submission.evidence.filter(e => e.confidence < 50).length;

  return {
    total: submission.evidence.length,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    averageConfidence: submission.evidence.length > 0
      ? submission.evidence.reduce((sum, e) => sum + e.confidence, 0) / submission.evidence.length
      : 0,
  };
}
