/**
 * Milestone 11: Monitoring & Change Detection
 * 
 * Impact evaluation using M10 decision layer.
 */

import type { ChangeSignificance, EvidenceDiff } from "./types";
import { calculateScores } from "../decision/scoring";
import type { DecisionInput } from "../decision/types";

/**
 * Evaluate the significance of a change using decision layer logic
 */
export function evaluateChangeSignificance(
  diff: EvidenceDiff,
  context: {
    totalBusinesses: number;
    affectedBusinesses: number;
    relatedChanges: number; // How many similar changes in this run
  }
): ChangeSignificance {
  // Build a simplified decision input for the change
  const decisionInput: DecisionInput = {
    totalBusinesses: context.totalBusinesses,
    affectedBusinesses: context.affectedBusinesses,
    evidenceCount: diff.changeType === "new" ? 1 : diff.changeType === "removed" ? -1 : 0,
    evidenceQuality: "medium", // Default to medium for detected changes
    confidenceScore: 70, // Default confidence for detected changes
    knowns: [],
    unknowns: [],
    hasContradictions: false,
    contradictionCount: 0,
    validationComplexity: "low",
    estimatedValidationCost: "LOW",
    hypothesisTitle: generateChangeTitle(diff),
    hypothesisStatement: generateChangeStatement(diff),
    problemCategory: undefined,
  };

  // Calculate scores
  const scores = calculateScores(decisionInput);

  // Adjust significance based on change type and related changes
  let rawScore = scores.evidenceStrength;

  // Boost score for changes affecting multiple businesses
  if (context.relatedChanges > 1) {
    rawScore += Math.min(20, context.relatedChanges * 5);
  }

  // Adjust based on change type
  switch (diff.changeType) {
    case "new":
      rawScore += 10; // New evidence is generally significant
      break;
    case "removed":
      rawScore += 15; // Removed evidence is more significant (potential signal loss)
      break;
    case "changed":
      rawScore += 5; // Changed evidence is moderately significant
      break;
    case "unchanged":
      rawScore = 0;
      break;
    case "uncertain":
      rawScore = 10; // Uncertain changes warrant investigation
      break;
  }

  // Map score to significance
  if (rawScore >= 75) return "critical";
  if (rawScore >= 55) return "high";
  if (rawScore >= 35) return "medium";
  return "low";
}

/**
 * Generate a title for the change
 */
function generateChangeTitle(diff: EvidenceDiff): string {
  switch (diff.changeType) {
    case "new":
      return "New evidence detected";
    case "removed":
      return "Evidence removed";
    case "changed":
      return "Evidence changed";
    case "unchanged":
      return "No change";
    case "uncertain":
      return "Uncertain change";
    default:
      return "Unknown change";
  }
}

/**
 * Generate a statement for the change
 */
function generateChangeStatement(diff: EvidenceDiff): string {
  const afterStatement = diff.after.statement || "Unknown";
  const beforeStatement = diff.before.statement || "Unknown";

  switch (diff.changeType) {
    case "new":
      return `New evidence: ${afterStatement}`;
    case "removed":
      return `Removed evidence: ${beforeStatement}`;
    case "changed":
      return `Changed from "${beforeStatement}" to "${afterStatement}"`;
    case "unchanged":
      return "No change detected";
    case "uncertain":
      return "Unable to determine change";
    default:
      return "Unknown change detected";
  }
}

/**
 * Evaluate significance for multiple changes
 */
export function evaluateChangesSignificance(
  diffs: EvidenceDiff[],
  context: {
    totalBusinesses: number;
  }
): Map<string, ChangeSignificance> {
  const significanceMap = new Map<string, ChangeSignificance>();

  // Group changes by business
  const businessChanges = new Map<string, EvidenceDiff[]>();
  for (const diff of diffs) {
    const existing = businessChanges.get(diff.businessId) || [];
    existing.push(diff);
    businessChanges.set(diff.businessId, existing);
  }

  // Evaluate each change
  for (const diff of diffs) {
    const businessChangeCount = (businessChanges.get(diff.businessId) || []).length;
    const significance = evaluateChangeSignificance(diff, {
      totalBusinesses: context.totalBusinesses,
      affectedBusinesses: businessChanges.size,
      relatedChanges: businessChangeCount,
    });
    significanceMap.set(diff.evidenceId, significance);
  }

  return significanceMap;
}

/**
 * Filter changes by significance threshold
 */
export function filterChangesBySignificance(
  diffs: EvidenceDiff[],
  significanceMap: Map<string, ChangeSignificance>,
  threshold: ChangeSignificance
): EvidenceDiff[] {
  const significanceOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  const thresholdValue = significanceOrder[threshold];

  return diffs.filter(diff => {
    const significance = significanceMap.get(diff.evidenceId) || "low";
    return significanceOrder[significance] >= thresholdValue;
  });
}

/**
 * Generate impact summary
 */
export function generateImpactSummary(
  diffs: EvidenceDiff[],
  significanceMap: Map<string, ChangeSignificance>
): {
  totalChanges: number;
  bySignificance: Record<ChangeSignificance, number>;
  byType: Record<string, number>;
  affectedBusinesses: number;
} {
  const bySignificance: Record<ChangeSignificance, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  const byType: Record<string, number> = {};
  const affectedBusinesses = new Set<string>();

  for (const diff of diffs) {
    const significance = significanceMap.get(diff.evidenceId) || "low";
    bySignificance[significance]++;
    byType[diff.changeType] = (byType[diff.changeType] || 0) + 1;
    affectedBusinesses.add(diff.businessId);
  }

  return {
    totalChanges: diffs.length,
    bySignificance,
    byType,
    affectedBusinesses: affectedBusinesses.size,
  };
}
