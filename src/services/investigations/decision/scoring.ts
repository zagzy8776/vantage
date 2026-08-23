/**
 * Milestone 10: Explainable Opportunity Decision Layer
 * 
 * Deterministic scoring rules for decision factors.
 * All scores are on a 0-100 scale unless noted otherwise.
 */

import type { DecisionInput, DecisionScores, ValidationCost } from "./types";

/**
 * Calculate evidence strength score (0-100)
 * 
 * Factors:
 * - Evidence count (more = stronger, diminishing returns)
 * - Evidence quality (low/medium/high)
 * - Affected business ratio (more businesses affected = stronger signal)
 */
export function calculateEvidenceStrength(input: DecisionInput): number {
  const { evidenceCount, evidenceQuality, affectedBusinesses, totalBusinesses } = input;

  if (totalBusinesses === 0) return 0;

  // Base score from evidence count (0-60, diminishing returns)
  const countScore = Math.min(60, evidenceCount * 15);
  
  // Quality multiplier
  const qualityMultiplier = evidenceQuality === "high" ? 1.0 : 
                            evidenceQuality === "medium" ? 0.7 : 0.4;
  
  // Business reach bonus (0-40)
  const reachRatio = totalBusinesses > 0 ? affectedBusinesses / totalBusinesses : 0;
  const reachBonus = reachRatio * 40;
  
  const rawScore = (countScore * qualityMultiplier) + reachBonus;
  return Math.min(100, Math.max(0, rawScore));
}

/**
 * Calculate affected business reach score (0-100)
 * 
 * Based on the proportion of businesses showing the signal
 */
export function calculateAffectedBusinessReach(input: DecisionInput): number {
  const { affectedBusinesses, totalBusinesses } = input;
  
  if (totalBusinesses === 0) return 0;
  
  const ratio = affectedBusinesses / totalBusinesses;
  
  // Scale ratio to 0-100 with some curve
  // < 10% = low score, > 50% = high score
  if (ratio < 0.1) return Math.min(100, Math.floor(ratio * 300)); // 0-30
  if (ratio < 0.3) return Math.min(100, 30 + Math.floor((ratio - 0.1) * 175)); // 30-65
  return Math.min(100, 65 + Math.floor((ratio - 0.3) * 100)); // 65-95
}

/**
 * Calculate confidence score (0-100)
 * 
 * Uses the confidence score from synthesis, adjusted by:
 * - Evidence strength (stronger evidence = higher confidence)
 * - Unknown count (more unknowns = lower confidence)
 */
export function calculateConfidence(input: DecisionInput): number {
  const { confidenceScore, unknowns } = input;
  
  // Base confidence from synthesis
  let adjusted = confidenceScore;
  
  // Penalty for unknowns (each unknown reduces confidence by 5 points)
  const unknownPenalty = Math.min(30, unknowns.length * 5);
  adjusted -= unknownPenalty;
  
  return Math.min(100, Math.max(0, adjusted));
}

/**
 * Calculate validation ease score (0-100)
 * 
 * Higher score = easier to validate
 * Factors:
 * - Validation complexity (low/medium/high)
 * - Estimated cost (low/medium/high)
 */
export function calculateValidationEase(input: DecisionInput): number {
  const { validationComplexity, estimatedValidationCost } = input;
  
  let score = 50; // Base score
  
  // Complexity adjustment
  if (validationComplexity === "low") score += 30;
  else if (validationComplexity === "medium") score += 10;
  else score -= 20; // high complexity
  
  // Cost adjustment
  if (estimatedValidationCost === "LOW") score += 20;
  else if (estimatedValidationCost === "MEDIUM") score -= 10;
  else score -= 30; // HIGH cost
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate unknown penalty (0-100, subtracted from total)
 * 
 * More unknowns = higher penalty
 */
export function calculateUnknownPenalty(input: DecisionInput): number {
  const { unknowns } = input;
  
  // Each unknown adds 10 points penalty, capped at 50
  return Math.min(50, unknowns.length * 10);
}

/**
 * Calculate contradiction penalty (0-100, subtracted from total)
 * 
 * Contradictions significantly reduce trust in the hypothesis
 */
export function calculateContradictionPenalty(input: DecisionInput): number {
  const { hasContradictions, contradictionCount } = input;
  
  if (!hasContradictions) return 0;
  
  // Each contradiction adds 25 points penalty, capped at 100
  return Math.min(100, contradictionCount * 25);
}

/**
 * Calculate all decision scores
 */
export function calculateScores(input: DecisionInput): DecisionScores {
  return {
    evidenceStrength: calculateEvidenceStrength(input),
    affectedBusinessReach: calculateAffectedBusinessReach(input),
    confidence: calculateConfidence(input),
    validationEase: calculateValidationEase(input),
    unknownPenalty: calculateUnknownPenalty(input),
    contradictionPenalty: calculateContradictionPenalty(input),
  };
}

/**
 * Estimate validation cost from complexity
 */
export function estimateValidationCost(
  validationComplexity: "low" | "medium" | "high"
): ValidationCost {
  if (validationComplexity === "low") return "LOW";
  if (validationComplexity === "medium") return "MEDIUM";
  return "HIGH";
}
