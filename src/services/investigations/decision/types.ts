/**
 * Milestone 10: Explainable Opportunity Decision Layer
 * 
 * Types for the decision layer that provides explainable priority scoring
 * for opportunities and findings based on deterministic rules.
 */

export type DecisionPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ValidationCost = "LOW" | "MEDIUM" | "HIGH";
export type ValidationActionType = "interview" | "research" | "verify" | "collect_data" | "manual_review";

/**
 * Individual scoring factors (0-100 scale)
 */
export interface DecisionScores {
  evidenceStrength: number;      // Quality and quantity of evidence
  affectedBusinessReach: number; // Proportion of businesses affected
  confidence: number;            // Overall confidence in the hypothesis
  validationEase: number;        // How easy to validate (higher = easier)
  unknownPenalty: number;        // Penalty for unknowns (0-100, subtracted)
  contradictionPenalty: number;  // Penalty for contradictions (0-100, subtracted)
}

/**
 * Calculated decision result
 */
export interface DecisionResult {
  priority: DecisionPriority;
  rawScore: number;             // Calculated score (0-100)
  scores: DecisionScores;
  
  // Plain-language explanation (default UI view)
  explanation: {
    title: string;               // e.g., "Appointment workflow optimization"
    why: string[];              // Bullet points explaining the priority
    known: string[];             // What we know
    unknown: string[];           // What we don't know
    nextAction: {
      action: string;            // e.g., "Interview 3 business owners"
      type: ValidationActionType;
      cost: ValidationCost;
    };
  };
  
  // Technical breakdown (expandable for advanced users)
  breakdown: {
    evidenceStrength: number;
    affectedBusinessReach: number;
    confidence: number;
    validationEase: number;
    unknownPenalty: number;
    contradictionPenalty: number;
    calculation: string;         // Formula used
  };
}

/**
 * Input data for decision calculation
 */
export interface DecisionInput {
  // Evidence data
  totalBusinesses: number;
  affectedBusinesses: number;
  evidenceCount: number;
  evidenceQuality: "low" | "medium" | "high";
  
  // Confidence data
  confidenceScore: number;      // 0-100 from synthesis
  
  // Knowns/unknowns
  knowns: string[];
  unknowns: string[];
  
  // Contradictions
  hasContradictions: boolean;
  contradictionCount: number;
  
  // Validation difficulty
  validationComplexity: "low" | "medium" | "high";
  estimatedValidationCost: ValidationCost;
  
  // Hypothesis details
  hypothesisTitle: string;
  hypothesisStatement: string;
  problemCategory?: string;
}

/**
 * Validation action recommendation
 */
export interface ValidationAction {
  action: string;
  type: ValidationActionType;
  cost: ValidationCost;
  estimatedEffort: string;      // e.g., "~3 interviews", "2 hours research"
  rationale: string;
}
