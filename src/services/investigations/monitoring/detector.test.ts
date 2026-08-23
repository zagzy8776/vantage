/**
 * Milestone 11: Monitoring & Change Detection
 * 
 * Tests for change detection logic.
 */

import { describe, it, expect } from "vitest";
import {
  detectChangeType,
  generateEvidenceDiff,
  compareBusinessEvidence,
  groupChangesByBusiness,
  summarizeChangesByType,
  generateChangeDescription,
} from "./detector";
import type { ChangeType } from "./types";

describe("Change Detection", () => {
  describe("detectChangeType", () => {
    it("detects new evidence", () => {
      const before = null;
      const after = { statement: "New booking system", category: "booking", sourceUrl: "https://example.com" };
      
      const changeType = detectChangeType(before, after);
      expect(changeType).toBe("new");
    });

    it("detects removed evidence", () => {
      const before = { statement: "Old booking system", category: "booking", sourceUrl: "https://example.com" };
      const after = null;
      
      const changeType = detectChangeType(before, after);
      expect(changeType).toBe("removed");
    });

    it("detects changed evidence", () => {
      const before = { statement: "Old booking system", category: "booking", sourceUrl: "https://example.com" };
      const after = { statement: "New booking system", category: "booking", sourceUrl: "https://example.com" };
      
      const changeType = detectChangeType(before, after);
      expect(changeType).toBe("changed");
    });

    it("detects unchanged evidence", () => {
      const before = { statement: "Booking system", category: "booking", sourceUrl: "https://example.com" };
      const after = { statement: "Booking system", category: "booking", sourceUrl: "https://example.com" };
      
      const changeType = detectChangeType(before, after);
      expect(changeType).toBe("unchanged");
    });

    it("detects uncertain when both null", () => {
      const before = null;
      const after = null;
      
      const changeType = detectChangeType(before, after);
      expect(changeType).toBe("unchanged");
    });
  });

  describe("generateEvidenceDiff", () => {
    it("generates diff for new evidence", () => {
      const diff = generateEvidenceDiff(
        "ev1",
        "biz1",
        null,
        { statement: "New evidence", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
        "test-source"
      );

      expect(diff.changeType).toBe("new");
      expect(diff.before.statement).toBeNull();
      expect(diff.after.statement).toBe("New evidence");
    });

    it("generates diff for removed evidence", () => {
      const diff = generateEvidenceDiff(
        "ev1",
        "biz1",
        { statement: "Old evidence", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
        null,
        "test-source"
      );

      expect(diff.changeType).toBe("removed");
      expect(diff.before.statement).toBe("Old evidence");
      expect(diff.after.statement).toBeNull();
    });

    it("includes detected timestamp", () => {
      const before = new Date();
      const diff = generateEvidenceDiff(
        "ev1",
        "biz1",
        null,
        { statement: "New", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
        "test-source"
      );

      expect(diff.detectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe("compareBusinessEvidence", () => {
    it("detects new evidence in after set", () => {
      const before: Array<{ id: string; statement: string; category: string; sourceUrl: string; observedAt: Date }> = [];
      const after = [
        { id: "ev1", statement: "New booking", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
      ];

      const diffs = compareBusinessEvidence("biz1", before, after, "test-source");
      expect(diffs).toHaveLength(1);
      expect(diffs[0].changeType).toBe("new");
    });

    it("detects removed evidence from before set", () => {
      const before = [
        { id: "ev1", statement: "Old booking", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
      ];
      const after: Array<{ id: string; statement: string; category: string; sourceUrl: string; observedAt: Date }> = [];

      const diffs = compareBusinessEvidence("biz1", before, after, "test-source");
      expect(diffs).toHaveLength(1);
      expect(diffs[0].changeType).toBe("removed");
    });

    it("detects changed evidence", () => {
      const before = [
        { id: "ev1", statement: "Old booking", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
      ];
      const after = [
        { id: "ev1", statement: "New booking", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
      ];

      const diffs = compareBusinessEvidence("biz1", before, after, "test-source");
      expect(diffs).toHaveLength(1);
      expect(diffs[0].changeType).toBe("changed");
    });

    it("excludes unchanged evidence", () => {
      const before = [
        { id: "ev1", statement: "Same booking", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
      ];
      const after = [
        { id: "ev1", statement: "Same booking", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
      ];

      const diffs = compareBusinessEvidence("biz1", before, after, "test-source");
      expect(diffs).toHaveLength(0);
    });

    it("handles multiple changes", () => {
      const before = [
        { id: "ev1", statement: "Old 1", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
        { id: "ev2", statement: "Old 2", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
      ];
      const after = [
        { id: "ev1", statement: "New 1", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
        { id: "ev3", statement: "New 3", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
      ];

      const diffs = compareBusinessEvidence("biz1", before, after, "test-source");
      expect(diffs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("groupChangesByBusiness", () => {
    it("groups diffs by business ID", () => {
      const diffs = [
        { evidenceId: "ev1", businessId: "biz1", changeType: "new" as ChangeType, before: { statement: null, category: null, sourceUrl: null, observedAt: null }, after: { statement: "Test", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() }, source: "test", detectedAt: new Date() },
        { evidenceId: "ev2", businessId: "biz1", changeType: "changed" as ChangeType, before: { statement: "Old", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() }, after: { statement: "New", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() }, source: "test", detectedAt: new Date() },
        { evidenceId: "ev3", businessId: "biz2", changeType: "new" as ChangeType, before: { statement: null, category: null, sourceUrl: null, observedAt: null }, after: { statement: "Test", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() }, source: "test", detectedAt: new Date() },
      ];

      const grouped = groupChangesByBusiness(diffs);
      
      expect(grouped.size).toBe(2);
      expect(grouped.get("biz1")).toHaveLength(2);
      expect(grouped.get("biz2")).toHaveLength(1);
    });
  });

  describe("summarizeChangesByType", () => {
    it("counts changes by type", () => {
      const diffs = [
        { evidenceId: "ev1", businessId: "biz1", changeType: "new" as ChangeType, before: { statement: null, category: null, sourceUrl: null, observedAt: null }, after: { statement: "Test", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() }, source: "test", detectedAt: new Date() },
        { evidenceId: "ev2", businessId: "biz1", changeType: "new" as ChangeType, before: { statement: null, category: null, sourceUrl: null, observedAt: null }, after: { statement: "Test", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() }, source: "test", detectedAt: new Date() },
        { evidenceId: "ev3", businessId: "biz1", changeType: "changed" as ChangeType, before: { statement: "Old", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() }, after: { statement: "New", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() }, source: "test", detectedAt: new Date() },
        { evidenceId: "ev4", businessId: "biz1", changeType: "removed" as ChangeType, before: { statement: "Old", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() }, after: { statement: null, category: null, sourceUrl: null, observedAt: null }, source: "test", detectedAt: new Date() },
      ];

      const summary = summarizeChangesByType(diffs);
      
      expect(summary.new).toBe(2);
      expect(summary.changed).toBe(1);
      expect(summary.removed).toBe(1);
      expect(summary.unchanged).toBe(0);
    });
  });

  describe("generateChangeDescription", () => {
    it("generates description for new evidence", () => {
      const diff = {
        evidenceId: "ev1",
        businessId: "biz1",
        changeType: "new" as ChangeType,
        before: { statement: null, category: null, sourceUrl: null, observedAt: null },
        after: { statement: "New booking system", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
        source: "test",
        detectedAt: new Date(),
      };

      const description = generateChangeDescription(diff);
      expect(description).toContain("New evidence");
      expect(description).toContain("New booking system");
    });

    it("generates description for removed evidence", () => {
      const diff = {
        evidenceId: "ev1",
        businessId: "biz1",
        changeType: "removed" as ChangeType,
        before: { statement: "Old booking system", category: "booking", sourceUrl: "https://example.com", observedAt: new Date() },
        after: { statement: null, category: null, sourceUrl: null, observedAt: null },
        source: "test",
        detectedAt: new Date(),
      };

      const description = generateChangeDescription(diff);
      expect(description).toContain("Removed evidence");
      expect(description).toContain("Old booking system");
    });

    it("generates description for changed evidence", () => {
      const diff = {
        evidenceId: "ev1",
        businessId: "biz1",
        changeType: "changed" as ChangeType,
        before: { statement: "Old booking", category: "booking", sourceUrl: "https://old.com", observedAt: new Date() },
        after: { statement: "New booking", category: "cancellation", sourceUrl: "https://new.com", observedAt: new Date() },
        source: "test",
        detectedAt: new Date(),
      };

      const description = generateChangeDescription(diff);
      expect(description).toContain("Changed evidence");
      expect(description).toContain("statement");
    });
  });
});
