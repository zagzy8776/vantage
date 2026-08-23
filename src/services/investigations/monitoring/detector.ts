/**
 * Milestone 11: Monitoring & Change Detection
 * 
 * Change detection logic for comparing evidence states.
 */

import type { ChangeType, EvidenceDiff } from "./types";

/**
 * Compare two evidence items and determine change type
 */
export function detectChangeType(
  before: { statement: string | null; category: string | null; sourceUrl: string | null } | null,
  after: { statement: string | null; category: string | null; sourceUrl: string | null } | null
): ChangeType {
  // No evidence before or after
  if (!before && !after) {
    return "unchanged";
  }

  // New evidence
  if (!before && after) {
    return "new";
  }

  // Removed evidence
  if (before && !after) {
    return "removed";
  }

  // Both exist - check for changes
  if (before && after) {
    const statementChanged = before.statement !== after.statement;
    const categoryChanged = before.category !== after.category;
    const sourceChanged = before.sourceUrl !== after.sourceUrl;

    if (statementChanged || categoryChanged || sourceChanged) {
      return "changed";
    }

    return "unchanged";
  }

  return "uncertain";
}

/**
 * Generate evidence diff between two states
 */
export function generateEvidenceDiff(
  evidenceId: string,
  businessId: string,
  before: { statement: string | null; category: string | null; sourceUrl: string | null; observedAt: Date | null } | null,
  after: { statement: string | null; category: string | null; sourceUrl: string | null; observedAt: Date | null } | null,
  source: string
): EvidenceDiff {
  const changeType = detectChangeType(before, after);

  return {
    evidenceId,
    businessId,
    changeType,
    before: {
      statement: before?.statement || null,
      category: before?.category || null,
      sourceUrl: before?.sourceUrl || null,
      observedAt: before?.observedAt || null,
    },
    after: {
      statement: after?.statement || null,
      category: after?.category || null,
      sourceUrl: after?.sourceUrl || null,
      observedAt: after?.observedAt || null,
    },
    source,
    detectedAt: new Date(),
  };
}

/**
 * Compare evidence sets for a business
 */
export function compareBusinessEvidence(
  businessId: string,
  beforeEvidence: Array<{ id: string; statement: string; category: string; sourceUrl: string; observedAt: Date }>,
  afterEvidence: Array<{ id: string; statement: string; category: string; sourceUrl: string; observedAt: Date }>,
  source: string
): EvidenceDiff[] {
  const diffs: EvidenceDiff[] = [];
  const beforeMap = new Map(beforeEvidence.map(e => [e.id, e]));
  const afterMap = new Map(afterEvidence.map(e => [e.id, e]));

  const allIds = new Set([...Array.from(beforeMap.keys()), ...Array.from(afterMap.keys())]);

  for (const evidenceId of Array.from(allIds)) {
    const before = beforeMap.get(evidenceId) || null;
    const after = afterMap.get(evidenceId) || null;

    const diff = generateEvidenceDiff(
      evidenceId,
      businessId,
      before ? {
        statement: before.statement,
        category: before.category,
        sourceUrl: before.sourceUrl,
        observedAt: before.observedAt,
      } : null,
      after ? {
        statement: after.statement,
        category: after.category,
        sourceUrl: after.sourceUrl,
        observedAt: after.observedAt,
      } : null,
      source
    );

    // Only include if there's an actual change
    if (diff.changeType !== "unchanged") {
      diffs.push(diff);
    }
  }

  return diffs;
}

/**
 * Group changes by business
 */
export function groupChangesByBusiness(
  diffs: EvidenceDiff[]
): Map<string, EvidenceDiff[]> {
  const grouped = new Map<string, EvidenceDiff[]>();

  for (const diff of diffs) {
    const existing = grouped.get(diff.businessId) || [];
    existing.push(diff);
    grouped.set(diff.businessId, existing);
  }

  return grouped;
}

/**
 * Summarize changes by type
 */
export function summarizeChangesByType(diffs: EvidenceDiff[]): Record<ChangeType, number> {
  const summary: Record<ChangeType, number> = {
    new: 0,
    changed: 0,
    removed: 0,
    unchanged: 0,
    uncertain: 0,
  };

  for (const diff of diffs) {
    summary[diff.changeType]++;
  }

  return summary;
}

/**
 * Generate human-readable change description
 */
export function generateChangeDescription(diff: EvidenceDiff): string {
  switch (diff.changeType) {
    case "new":
      return `New evidence: ${diff.after.statement || "Unknown"}`;
    case "removed":
      return `Removed evidence: ${diff.before.statement || "Unknown"}`;
    case "changed":
      const changes: string[] = [];
      if (diff.before.statement !== diff.after.statement) {
        changes.push("statement");
      }
      if (diff.before.category !== diff.after.category) {
        changes.push("category");
      }
      if (diff.before.sourceUrl !== diff.after.sourceUrl) {
        changes.push("source");
      }
      return `Changed evidence: ${changes.join(", ")}`;
    case "unchanged":
      return "No change";
    case "uncertain":
      return "Unable to determine change";
    default:
      return "Unknown change";
  }
}
