/**
 * Milestone 10: Explainable Opportunity Decision Layer
 * 
 * Main decision calculator that combines scoring factors into a priority.
 */

import type { DecisionInput, DecisionResult, DecisionPriority } from "./types";
import { calculateScores } from "./scoring";

/**
 * Calculate raw score from individual factors
 * 
 * Formula:
 * (evidenceStrength * 0.3) +
 * (affectedBusinessReach * 0.2) +
 * (confidence * 0.25) +
 * (validationEase * 0.15) -
 * unknownPenalty -
 * contradictionPenalty
 * 
 * Weights prioritize evidence and confidence, but validation ease
 * matters because we want actionable opportunities.
 */
export function calculateRawScore(scores: ReturnType<typeof calculateScores>): number {
  const {
    evidenceStrength,
    affectedBusinessReach,
    confidence,
    validationEase,
    unknownPenalty,
    contradictionPenalty,
  } = scores;
  
  const weightedSum = 
    (evidenceStrength * 0.3) +
    (affectedBusinessReach * 0.2) +
    (confidence * 0.25) +
    (validationEase * 0.15);
  
  const rawScore = weightedSum - unknownPenalty - contradictionPenalty;
  
  return Math.min(100, Math.max(0, rawScore));
}

/**
 * Convert raw score to priority level
 */
export function scoreToPriority(rawScore: number): DecisionPriority {
  if (rawScore >= 75) return "CRITICAL";
  if (rawScore >= 55) return "HIGH";
  if (rawScore >= 35) return "MEDIUM";
  return "LOW";
}

/**
 * Generate calculation formula string for breakdown
 */
export function generateCalculationFormula(scores: ReturnType<typeof calculateScores>): string {
  const {
    evidenceStrength,
    affectedBusinessReach,
    confidence,
    validationEase,
    unknownPenalty,
    contradictionPenalty,
  } = scores;
  
  const weightedSum = 
    (evidenceStrength * 0.3) +
    (affectedBusinessReach * 0.2) +
    (confidence * 0.25) +
    (validationEase * 0.15);
  
  const rawScore = weightedSum - unknownPenalty - contradictionPenalty;
  
  return `(${evidenceStrength} × 0.3) + (${affectedBusinessReach} × 0.2) + (${confidence} × 0.25) + (${validationEase} × 0.15) - ${unknownPenalty} - ${contradictionPenalty} = ${rawScore.toFixed(1)}`;
}

/**
 * Main decision calculation function
 */
export function calculateDecision(input: DecisionInput): Omit<DecisionResult, "explanation"> {
  const scores = calculateScores(input);
  const rawScore = calculateRawScore(scores);
  const priority = scoreToPriority(rawScore);
  
  return {
    priority,
    rawScore: Math.round(rawScore),
    scores,
    breakdown: {
      evidenceStrength: scores.evidenceStrength,
      affectedBusinessReach: scores.affectedBusinessReach,
      confidence: scores.confidence,
      validationEase: scores.validationEase,
      unknownPenalty: scores.unknownPenalty,
      contradictionPenalty: scores.contradictionPenalty,
      calculation: generateCalculationFormula(scores),
    },
  };
}
