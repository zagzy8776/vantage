/**
 * Milestone 11: Monitoring & Change Detection
 * 
 * Tests for human review workflow.
 */

import { describe, it, expect } from "vitest";
import {
  createChangeReview,
  approveChangeReview,
  rejectChangeReview,
  markForInvestigation,
  requiresReview,
  createChangeReviews,
  getReviewStatistics,
  areReviewsComplete,
  getPendingReviews,
  getReviewsByStatus,
} from "./review";
import type { ChangeSignificance, EvidenceDiff } from "./types";

describe("Review Workflow", () => {
  describe("createChangeReview", () => {
    it("creates a pending review", () => {
      const review = createChangeReview("run1", "change1", "high");
      
      expect(review.monitoringRunId).toBe("run1");
      expect(review.changeId).toBe("change1");
      expect(review.status).toBe("pending");
      expect(review.reviewedAt).toBeNull();
      expect(review.reviewedBy).toBeNull();
      expect(review.actionTaken).toBeNull();
    });

    it("generates unique IDs", () => {
      const review1 = createChangeReview("run1", "change1", "high");
      const review2 = createChangeReview("run1", "change1", "high");
      
      expect(review1.id).not.toBe(review2.id);
    });
  });

  describe("approveChangeReview", () => {
    it("approves a review", () => {
      const review = createChangeReview("run1", "change1", "high");
      const approved = approveChangeReview(review, "user1", "Looks good");
      
      expect(approved.status).toBe("approved");
      expect(approved.reviewedBy).toBe("user1");
      expect(approved.notes).toBe("Looks good");
      expect(approved.actionTaken).toBe("accepted");
      expect(approved.reviewedAt).not.toBeNull();
    });

    it("approves without notes", () => {
      const review = createChangeReview("run1", "change1", "high");
      const approved = approveChangeReview(review, "user1");
      
      expect(approved.status).toBe("approved");
      expect(approved.notes).toBeNull();
    });
  });

  describe("rejectChangeReview", () => {
    it("rejects a review", () => {
      const review = createChangeReview("run1", "change1", "high");
      const rejected = rejectChangeReview(review, "user1", "False positive");
      
      expect(rejected.status).toBe("rejected");
      expect(rejected.reviewedBy).toBe("user1");
      expect(rejected.notes).toBe("False positive");
      expect(rejected.actionTaken).toBe("rejected");
    });
  });

  describe("markForInvestigation", () => {
    it("marks for investigation", () => {
      const review = createChangeReview("run1", "change1", "high");
      const investigated = markForInvestigation(review, "user1", "Need more info");
      
      expect(investigated.status).toBe("needs_investigation");
      expect(investigated.reviewedBy).toBe("user1");
      expect(investigated.notes).toBe("Need more info");
      expect(investigated.actionTaken).toBe("investigated");
    });
  });

  describe("requiresReview", () => {
    it("requires review when significance meets threshold", () => {
      expect(requiresReview("high", "medium")).toBe(true);
      expect(requiresReview("critical", "high")).toBe(true);
      expect(requiresReview("critical", "low")).toBe(true);
    });

    it("does not require review when significance below threshold", () => {
      expect(requiresReview("low", "medium")).toBe(false);
      expect(requiresReview("medium", "high")).toBe(false);
    });

    it("requires review when significance equals threshold", () => {
      expect(requiresReview("medium", "medium")).toBe(true);
      expect(requiresReview("high", "high")).toBe(true);
    });
  });

  describe("createChangeReviews", () => {
    it("creates reviews for changes meeting threshold", () => {
      const diffs: EvidenceDiff[] = [
        {
          evidenceId: "ev1",
          businessId: "biz1",
          changeType: "new",
          before: { statement: null, category: null, sourceUrl: null, observedAt: null },
          after: { statement: "Test", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
          source: "test",
          detectedAt: new Date(),
        },
        {
          evidenceId: "ev2",
          businessId: "biz2",
          changeType: "changed",
          before: { statement: "Old", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
          after: { statement: "New", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
          source: "test",
          detectedAt: new Date(),
        },
      ];

      const significanceMap = new Map([
        ["ev1", "high" as ChangeSignificance],
        ["ev2", "low" as ChangeSignificance],
      ]);

      const reviews = createChangeReviews("run1", diffs, significanceMap, "medium");
      
      expect(reviews).toHaveLength(1);
      expect(reviews[0].changeId).toBe("ev1");
    });

    it("creates no reviews when no changes meet threshold", () => {
      const diffs: EvidenceDiff[] = [
        {
          evidenceId: "ev1",
          businessId: "biz1",
          changeType: "new",
          before: { statement: null, category: null, sourceUrl: null, observedAt: null },
          after: { statement: "Test", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
          source: "test",
          detectedAt: new Date(),
        },
      ];

      const significanceMap = new Map([
        ["ev1", "low" as ChangeSignificance],
      ]);

      const reviews = createChangeReviews("run1", diffs, significanceMap, "high");
      
      expect(reviews).toHaveLength(0);
    });
  });

  describe("getReviewStatistics", () => {
    it("calculates statistics", () => {
      const reviews = [
        createChangeReview("run1", "change1", "high"),
        approveChangeReview(createChangeReview("run1", "change2", "high"), "user1"),
        rejectChangeReview(createChangeReview("run1", "change3", "high"), "user1"),
        markForInvestigation(createChangeReview("run1", "change4", "high"), "user1"),
      ];

      const stats = getReviewStatistics(reviews);
      
      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.needsInvestigation).toBe(1);
    });

    it("handles empty array", () => {
      const stats = getReviewStatistics([]);
      
      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.approved).toBe(0);
      expect(stats.rejected).toBe(0);
      expect(stats.needsInvestigation).toBe(0);
    });
  });

  describe("areReviewsComplete", () => {
    it("returns true when all reviews complete", () => {
      const reviews = [
        approveChangeReview(createChangeReview("run1", "change1", "high"), "user1"),
        rejectChangeReview(createChangeReview("run1", "change2", "high"), "user1"),
      ];

      expect(areReviewsComplete(reviews)).toBe(true);
    });

    it("returns false when pending reviews exist", () => {
      const reviews = [
        approveChangeReview(createChangeReview("run1", "change1", "high"), "user1"),
        createChangeReview("run1", "change2", "high"),
      ];

      expect(areReviewsComplete(reviews)).toBe(false);
    });

    it("returns true for empty array", () => {
      expect(areReviewsComplete([])).toBe(true);
    });
  });

  describe("getPendingReviews", () => {
    it("filters pending reviews", () => {
      const reviews = [
        createChangeReview("run1", "change1", "high"),
        approveChangeReview(createChangeReview("run1", "change2", "high"), "user1"),
        createChangeReview("run1", "change3", "high"),
      ];

      const pending = getPendingReviews(reviews);
      
      expect(pending).toHaveLength(2);
      expect(pending.every(r => r.status === "pending")).toBe(true);
    });
  });

  describe("getReviewsByStatus", () => {
    it("filters by status", () => {
      const reviews = [
        createChangeReview("run1", "change1", "high"),
        approveChangeReview(createChangeReview("run1", "change2", "high"), "user1"),
        rejectChangeReview(createChangeReview("run1", "change3", "high"), "user1"),
      ];

      const approved = getReviewsByStatus(reviews, "approved");
      const rejected = getReviewsByStatus(reviews, "rejected");
      const pending = getReviewsByStatus(reviews, "pending");
      
      expect(approved).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(pending).toHaveLength(1);
    });
  });
});
