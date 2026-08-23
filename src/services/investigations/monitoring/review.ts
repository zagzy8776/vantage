/**
 * Milestone 11: Monitoring & Change Detection
 * 
 * Human review workflow for detected changes.
 */

import type { ReviewStatus, ChangeReview, EvidenceDiff, ChangeSignificance } from "./types";
import { newId } from "@/lib/ids";

/**
 * Create a change review item
 */
export function createChangeReview(
  monitoringRunId: string,
  changeId: string,
  _significance: ChangeSignificance
): ChangeReview {
  return {
    id: newId(),
    monitoringRunId,
    changeId,
    status: "pending",
    reviewedAt: null,
    reviewedBy: null,
    notes: null,
    actionTaken: null,
  };
}

/**
 * Approve a change review
 */
export function approveChangeReview(
  review: ChangeReview,
  reviewedBy: string,
  notes?: string
): ChangeReview {
  return {
    ...review,
    status: "approved",
    reviewedAt: new Date(),
    reviewedBy,
    notes: notes || null,
    actionTaken: "accepted",
  };
}

/**
 * Reject a change review
 */
export function rejectChangeReview(
  review: ChangeReview,
  reviewedBy: string,
  notes?: string
): ChangeReview {
  return {
    ...review,
    status: "rejected",
    reviewedAt: new Date(),
    reviewedBy,
    notes: notes || null,
    actionTaken: "rejected",
  };
}

/**
 * Mark a change review as needing investigation
 */
export function markForInvestigation(
  review: ChangeReview,
  reviewedBy: string,
  notes?: string
): ChangeReview {
  return {
    ...review,
    status: "needs_investigation",
    reviewedAt: new Date(),
    reviewedBy,
    notes: notes || null,
    actionTaken: "investigated",
  };
}

/**
 * Determine if a change requires review based on significance
 */
export function requiresReview(
  significance: ChangeSignificance,
  alertThreshold: ChangeSignificance
): boolean {
  const significanceOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  return significanceOrder[significance] >= significanceOrder[alertThreshold];
}

/**
 * Batch create reviews for changes
 */
export function createChangeReviews(
  monitoringRunId: string,
  diffs: EvidenceDiff[],
  significanceMap: Map<string, ChangeSignificance>,
  alertThreshold: ChangeSignificance
): ChangeReview[] {
  const reviews: ChangeReview[] = [];

  for (const diff of diffs) {
    const significance = significanceMap.get(diff.evidenceId) || "low";
    
    if (requiresReview(significance, alertThreshold)) {
      reviews.push(createChangeReview(monitoringRunId, diff.evidenceId, significance));
    }
  }

  return reviews;
}

/**
 * Get review statistics
 */
export function getReviewStatistics(reviews: ChangeReview[]): {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  needsInvestigation: number;
} {
  return {
    total: reviews.length,
    pending: reviews.filter(r => r.status === "pending").length,
    approved: reviews.filter(r => r.status === "approved").length,
    rejected: reviews.filter(r => r.status === "rejected").length,
    needsInvestigation: reviews.filter(r => r.status === "needs_investigation").length,
  };
}

/**
 * Check if all reviews are complete
 */
export function areReviewsComplete(reviews: ChangeReview[]): boolean {
  return reviews.every(r => r.status !== "pending");
}

/**
 * Get pending reviews
 */
export function getPendingReviews(reviews: ChangeReview[]): ChangeReview[] {
  return reviews.filter(r => r.status === "pending");
}

/**
 * Get reviews by status
 */
export function getReviewsByStatus(
  reviews: ChangeReview[],
  status: ReviewStatus
): ChangeReview[] {
  return reviews.filter(r => r.status === status);
}
