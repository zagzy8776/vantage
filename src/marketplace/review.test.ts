import { describe, it, expect } from "vitest";
import {
  reviewSubmission,
  getPendingSubmissions,
  getSubmissionsByStatus,
  getSubmissionsForReviewer,
  getSubmissionStatistics,
  requiresReview,
  markForReview,
  autoRejectLowQuality,
  getEvidenceQualitySummary,
} from "./review";
import { submitEvidence } from "./service";

describe("Marketplace Review Workflow", () => {
  describe("reviewSubmission", () => {
    it("approves a valid submission", () => {
      const submission = submitEvidence(
        "task1",
        "user1",
        "Jane Doe",
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
        "Research conducted on 2024-01-15. This is a detailed note explaining the research process and methodology used to gather evidence from multiple sources."
      );

      const result = reviewSubmission(submission, "user2", "Good work", "approve");

      expect(result.approved).toBe(true);
      expect(result.status).toBe("approved");
      expect(result.evidenceToAccept).toHaveLength(3);
      expect(result.evidenceToReject).toHaveLength(0);
    });

    it("rejects a submission", () => {
      const submission = submitEvidence(
        "task1",
        "user1",
        "Jane",
        [{ statement: "Test", category: "booking", sourceUrl: "https://test.com", confidence: 80 }],
        [{ url: "https://test.com", title: "Test", type: "website" }],
        ["Observation"],
        ["Unknown"],
        "Notes"
      );

      const result = reviewSubmission(submission, "user2", "Not enough evidence", "reject");

      expect(result.approved).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.evidenceToAccept).toHaveLength(0);
      expect(result.evidenceToReject).toHaveLength(1);
    });

    it("requests revision", () => {
      const submission = submitEvidence(
        "task1",
        "user1",
        "Jane",
        [{ statement: "Test", category: "booking", sourceUrl: "https://test.com", confidence: 80 }],
        [{ url: "https://test.com", title: "Test", type: "website" }],
        ["Observation"],
        ["Unknown"],
        "Notes"
      );

      const result = reviewSubmission(submission, "user2", "Add more evidence", "request_revision");

      expect(result.approved).toBe(false);
      expect(result.status).toBe("needs_revision");
      expect(result.notes).toBe("Add more evidence");
    });

    it("rejects low-confidence evidence selectively", () => {
      const submission = submitEvidence(
        "task1",
        "user1",
        "Jane",
        [
          { statement: "High confidence evidence", category: "booking", sourceUrl: "https://test.com", confidence: 80 },
          { statement: "Low confidence evidence", category: "pricing", sourceUrl: "https://test.com", confidence: 30 },
          { statement: "Medium evidence", category: "hours", sourceUrl: "https://test.com", confidence: 60 },
        ],
        [
          { url: "https://test.com", title: "Test", type: "website" },
          { url: "https://test2.com", title: "Test 2", type: "website" },
        ],
        ["Observation 1"],
        ["Unknown 1"],
        "This is a detailed note explaining the research process and methodology used to gather evidence from multiple sources."
      );

      const result = reviewSubmission(submission, "user2", "Good", "approve");

      expect(result.approved).toBe(true);
      expect(result.evidenceToAccept).toHaveLength(2);
      expect(result.evidenceToReject).toHaveLength(1);
    });
  });

  describe("getPendingSubmissions", () => {
    it("filters pending submissions", () => {
      const sub1 = submitEvidence("task1", "user1", "Jane", [], [], [], [], "Notes");
      const sub2 = submitEvidence("task1", "user2", "Bob", [], [], [], [], "Notes");
      const sub3 = submitEvidence("task1", "user3", "Alice", [], [], [], [], "Notes");

      const updated = [sub1, sub2, sub3];
      updated[1].status = "under_review";
      updated[2].status = "approved";

      const pending = getPendingSubmissions(updated);

      expect(pending).toHaveLength(2);
      expect(pending.every(s => s.status === "pending" || s.status === "under_review")).toBe(true);
    });
  });

  describe("getSubmissionsByStatus", () => {
    it("filters submissions by status", () => {
      const sub1 = submitEvidence("task1", "user1", "Jane", [], [], [], [], "Notes");
      const sub2 = submitEvidence("task1", "user2", "Bob", [], [], [], [], "Notes");
      const sub3 = submitEvidence("task1", "user3", "Alice", [], [], [], [], "Notes");

      const updated = [sub1, sub2, sub3];
      updated[0].status = "approved";
      updated[1].status = "rejected";

      const approved = getSubmissionsByStatus(updated, "approved");

      expect(approved).toHaveLength(1);
      expect(approved[0].status).toBe("approved");
    });
  });

  describe("getSubmissionsForReviewer", () => {
    it("filters submissions by reviewer", () => {
      const sub1 = submitEvidence("task1", "user1", "Jane", [], [], [], [], "Notes");
      const sub2 = submitEvidence("task1", "user2", "Bob", [], [], [], [], "Notes");

      const updated = [sub1, sub2];
      updated[0].reviewedBy = "reviewer1";
      updated[1].reviewedBy = "reviewer2";

      const reviewer1Subs = getSubmissionsForReviewer(updated, "reviewer1");

      expect(reviewer1Subs).toHaveLength(1);
      expect(reviewer1Subs[0].reviewedBy).toBe("reviewer1");
    });
  });

  describe("getSubmissionStatistics", () => {
    it("calculates submission statistics", () => {
      const sub1 = submitEvidence("task1", "user1", "Jane", [], [], [], [], "Notes");
      const sub2 = submitEvidence("task1", "user2", "Bob", [], [], [], [], "Notes");
      const sub3 = submitEvidence("task1", "user3", "Alice", [], [], [], [], "Notes");
      const sub4 = submitEvidence("task1", "user4", "Tom", [], [], [], [], "Notes");

      const updated = [sub1, sub2, sub3, sub4];
      updated[0].status = "approved";
      updated[1].status = "approved";
      updated[2].status = "rejected";
      updated[3].status = "needs_revision";

      const stats = getSubmissionStatistics(updated);

      expect(stats.total).toBe(4);
      expect(stats.approved).toBe(2);
      expect(stats.rejected).toBe(1);
      expect(stats.needsRevision).toBe(1);
      expect(stats.approvalRate).toBe(50);
    });

    it("handles empty submissions", () => {
      const stats = getSubmissionStatistics([]);

      expect(stats.total).toBe(0);
      expect(stats.approvalRate).toBe(0);
    });
  });

  describe("requiresReview", () => {
    it("returns true for pending submissions", () => {
      const submission = submitEvidence("task1", "user1", "Jane", [], [], [], [], "Notes");
      submission.status = "pending";

      expect(requiresReview(submission)).toBe(true);
    });

    it("returns true for under_review submissions", () => {
      const submission = submitEvidence("task1", "user1", "Jane", [], [], [], [], "Notes");
      submission.status = "under_review";

      expect(requiresReview(submission)).toBe(true);
    });

    it("returns false for approved submissions", () => {
      const submission = submitEvidence("task1", "user1", "Jane", [], [], [], [], "Notes");
      submission.status = "approved";

      expect(requiresReview(submission)).toBe(false);
    });
  });

  describe("markForReview", () => {
    it("marks submission for review", () => {
      const submission = submitEvidence("task1", "user1", "Jane", [], [], [], [], "Notes");
      const marked = markForReview(submission);

      expect(marked.status).toBe("under_review");
      expect(marked.reviewedBy).toBe("system");
    });
  });

  describe("autoRejectLowQuality", () => {
    it("auto-rejects low quality submissions", () => {
      const submission = submitEvidence(
        "task1",
        "user1",
        "Jane",
        [{ statement: "Test", category: "booking", sourceUrl: "https://test.com", confidence: 80 }],
        [{ url: "https://test.com", title: "Test", type: "website" }],
        ["Observation"],
        ["Unknown"],
        "Notes"
      );

      const rejected = autoRejectLowQuality(submission);

      expect(rejected).not.toBeNull();
      expect(rejected?.status).toBe("rejected");
      expect(rejected?.reviewedBy).toBe("system");
    });

    it("does not reject high quality submissions", () => {
      const submission = submitEvidence(
        "task1",
        "user1",
        "Jane",
        [
          { statement: "Test 1", category: "booking", sourceUrl: "https://test.com", confidence: 80 },
          { statement: "Test 2", category: "pricing", sourceUrl: "https://test.com", confidence: 80 },
          { statement: "Test 3", category: "hours", sourceUrl: "https://test.com", confidence: 80 },
        ],
        [
          { url: "https://test.com", title: "Test 1", type: "website" },
          { url: "https://test2.com", title: "Test 2", type: "website" },
        ],
        ["Observation 1"],
        ["Unknown 1"],
        "This is a detailed note explaining the research process and methodology used to gather evidence from multiple sources."
      );

      const rejected = autoRejectLowQuality(submission);

      expect(rejected).toBeNull();
    });
  });

  describe("getEvidenceQualitySummary", () => {
    it("calculates evidence quality summary", () => {
      const submission = submitEvidence(
        "task1",
        "user1",
        "Jane",
        [
          { statement: "Test 1", category: "booking", sourceUrl: "https://test.com", confidence: 80 },
          { statement: "Test 2", category: "pricing", sourceUrl: "https://test.com", confidence: 90 },
          { statement: "Test 3", category: "hours", sourceUrl: "https://test.com", confidence: 40 },
          { statement: "Test 4", category: "contact", sourceUrl: "https://test.com", confidence: 60 },
          { statement: "Test 5", category: "location", sourceUrl: "https://test.com", confidence: 30 },
        ],
        [{ url: "https://test.com", title: "Test", type: "website" }],
        ["Observation"],
        ["Unknown"],
        "Notes"
      );

      const summary = getEvidenceQualitySummary(submission);

      expect(summary.total).toBe(5);
      expect(summary.highConfidence).toBe(2);
      expect(summary.mediumConfidence).toBe(1);
      expect(summary.lowConfidence).toBe(2);
      expect(summary.averageConfidence).toBe(60);
    });

    it("handles empty evidence", () => {
      const submission = submitEvidence("task1", "user1", "Jane", [], [], [], [], "Notes");
      const summary = getEvidenceQualitySummary(submission);

      expect(summary.total).toBe(0);
      expect(summary.averageConfidence).toBe(0);
    });
  });
});
