/**
 * Milestone 10: Explainable Opportunity Decision Layer
 * 
 * Service layer for integrating decision calculations with existing investigation/opportunity data.
 */

import type { DecisionInput, DecisionResult } from "./types";
import { generateFullDecision } from "./explanation";
import type { OpportunityHypothesisDraft } from "../opportunity/types";

/**
 * Convert opportunity synthesis data to DecisionInput format
 */
export function opportunityToDecisionInput(
  opportunity: OpportunityHypothesisDraft,
  context: {
    totalBusinesses: number;
    evidenceCount: number;
    evidenceQuality: "low" | "medium" | "high";
    unknowns: string[];
    hasContradictions: boolean;
    contradictionCount: number;
    validationComplexity: "low" | "medium" | "high";
  }
): DecisionInput {
  return {
    totalBusinesses: context.totalBusinesses,
    affectedBusinesses: opportunity.businessIds.length,
    evidenceCount: context.evidenceCount,
    evidenceQuality: context.evidenceQuality,
    confidenceScore: opportunity.confidence,
    knowns: opportunity.assumptions || [],
    unknowns: context.unknowns,
    hasContradictions: context.hasContradictions,
    contradictionCount: context.contradictionCount,
    validationComplexity: context.validationComplexity,
    estimatedValidationCost: estimateValidationCost(context.validationComplexity),
    hypothesisTitle: opportunity.title,
    hypothesisStatement: opportunity.statement,
    problemCategory: undefined, // TODO: Extract from economicHypothesis if needed
  };
}

/**
 * Estimate validation cost from complexity
 */
function estimateValidationCost(
  complexity: "low" | "medium" | "high"
): "LOW" | "MEDIUM" | "HIGH" {
  if (complexity === "low") return "LOW";
  if (complexity === "medium") return "MEDIUM";
  return "HIGH";
}

/**
 * Calculate decision for a single opportunity
 */
export function calculateOpportunityDecision(
  opportunity: OpportunityHypothesisDraft,
  context: {
    totalBusinesses: number;
    evidenceCount: number;
    evidenceQuality: "low" | "medium" | "high";
    unknowns: string[];
    hasContradictions: boolean;
    contradictionCount: number;
    validationComplexity: "low" | "medium" | "high";
  }
): DecisionResult {
  const input = opportunityToDecisionInput(opportunity, context);
  return generateFullDecision(input);
}

/**
 * Calculate decisions for multiple opportunities
 */
export function calculateOpportunityDecisions(
  opportunities: OpportunityHypothesisDraft[],
  context: {
    totalBusinesses: number;
    evidenceCount: number;
    evidenceQuality: "low" | "medium" | "high";
    unknowns: string[];
    hasContradictions: boolean;
    contradictionCount: number;
    validationComplexity: "low" | "medium" | "high";
  }
): DecisionResult[] {
  return opportunities.map((opportunity) =>
    calculateOpportunityDecision(opportunity, context)
  );
}

/**
 * Sort opportunities by decision priority (highest first)
 */
export function sortOpportunitiesByPriority(
  opportunities: Array<{ opportunity: OpportunityHypothesisDraft; decision: DecisionResult }>
): Array<{ opportunity: OpportunityHypothesisDraft; decision: DecisionResult }> {
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  
  return [...opportunities].sort((a, b) => {
    const priorityDiff = priorityOrder[a.decision.priority] - priorityOrder[b.decision.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // If same priority, sort by raw score
    return b.decision.rawScore - a.decision.rawScore;
  });
}

/**
 * Get top N opportunities by priority
 */
export function getTopOpportunities(
  opportunities: Array<{ opportunity: OpportunityHypothesisDraft; decision: DecisionResult }>,
  limit: number
): Array<{ opportunity: OpportunityHypothesisDraft; decision: DecisionResult }> {
  const sorted = sortOpportunitiesByPriority(opportunities);
  return sorted.slice(0, limit);
}
