/**
 * Milestone 10: Explainable Opportunity Decision Layer
 * 
 * Generate plain-language explanations from deterministic factors.
 * The AI helps with phrasing, but the content comes from the actual data.
 */

import type { DecisionInput, DecisionResult, ValidationActionType } from "./types";
import { calculateDecision } from "./calculator";
import { calculateScores } from "./scoring";

/**
 * Generate "Why" bullet points from deterministic factors
 */
export function generateWhyBullets(input: DecisionInput, scores: ReturnType<typeof calculateScores>): string[] {
  const bullets: string[] = [];
  
  // Business reach
  const reachRatio = input.totalBusinesses > 0 
    ? `${input.affectedBusinesses} of ${input.totalBusinesses} businesses reviewed show relevant signals`
    : `${input.affectedBusinesses} businesses show relevant signals`;
  bullets.push(reachRatio);
  
  // Evidence count
  bullets.push(`${input.evidenceCount} supporting evidence item${input.evidenceCount !== 1 ? 's' : ''} found`);
  
  // Confidence
  bullets.push(`confidence: ${scores.confidence}%`);
  
  // Financial impact (if unknown)
  const hasFinancialUnknown = input.unknowns.some(u => 
    u.toLowerCase().includes("revenue") || 
    u.toLowerCase().includes("cost") ||
    u.toLowerCase().includes("impact") ||
    u.toLowerCase().includes("financial")
  );
  if (hasFinancialUnknown) {
    bullets.push("financial impact: unknown");
  }
  
  // Validation difficulty
  const validationEffort = getValidationEffortDescription(input);
  bullets.push(`validation requires ${validationEffort}`);
  
  // Contradictions
  if (input.hasContradictions) {
    bullets.push(`${input.contradictionCount} major contradiction${input.contradictionCount !== 1 ? 's' : ''} detected`);
  } else {
    bullets.push("no major contradiction detected");
  }
  
  return bullets;
}

/**
 * Get human-readable validation effort description
 */
function getValidationEffortDescription(input: DecisionInput): string {
  const { validationComplexity, estimatedValidationCost } = input;
  
  if (validationComplexity === "low" && estimatedValidationCost === "LOW") {
    return "~1-2 hours of research";
  }
  if (validationComplexity === "low" && estimatedValidationCost === "MEDIUM") {
    return "~3 interviews";
  }
  if (validationComplexity === "medium" && estimatedValidationCost === "LOW") {
    return "~4 hours of research";
  }
  if (validationComplexity === "medium" && estimatedValidationCost === "MEDIUM") {
    return "~5 interviews";
  }
  if (validationComplexity === "high" && estimatedValidationCost === "MEDIUM") {
    return "~10 interviews";
  }
  if (validationComplexity === "high" && estimatedValidationCost === "HIGH") {
    return "significant field research";
  }
  
  return "additional validation";
}

/**
 * Determine best next action based on factors
 */
export function determineNextAction(input: DecisionInput): {
  action: string;
  type: ValidationActionType;
  cost: typeof input.estimatedValidationCost;
} {
  const { unknowns, validationComplexity } = input;
  
  // If many unknowns about business operations, recommend interviews
  const operationalUnknowns = unknowns.filter(u =>
    u.toLowerCase().includes("rate") ||
    u.toLowerCase().includes("process") ||
    u.toLowerCase().includes("workflow") ||
    u.toLowerCase().includes("policy")
  );
  
  if (operationalUnknowns.length >= 2) {
    const interviewCount = Math.min(10, Math.max(3, operationalUnknowns.length * 2));
    return {
      action: `Interview ${interviewCount} business owners`,
      type: "interview",
      cost: validationComplexity === "low" ? "LOW" : "MEDIUM",
    };
  }
  
  // If financial unknowns, recommend research
  const financialUnknowns = unknowns.filter(u =>
    u.toLowerCase().includes("revenue") ||
    u.toLowerCase().includes("cost") ||
    u.toLowerCase().includes("impact")
  );
  
  if (financialUnknowns.length >= 1) {
    return {
      action: "Research industry benchmarks",
      type: "research",
      cost: "LOW",
    };
  }
  
  // Default based on complexity
  if (validationComplexity === "low") {
    return {
      action: "Verify with 2-3 business owners",
      type: "verify",
      cost: "LOW",
    };
  }
  
  if (validationComplexity === "medium") {
    return {
      action: "Conduct structured interviews",
      type: "interview",
      cost: "MEDIUM",
    };
  }
  
  return {
    action: "Field research and data collection",
    type: "collect_data",
    cost: "HIGH",
  };
}

/**
 * Generate full explanation
 */
export function generateExplanation(
  input: DecisionInput,
  scores: ReturnType<typeof calculateScores>,
  _priority: string
): DecisionResult["explanation"] {
  const whyBullets = generateWhyBullets(input, scores);
  const nextAction = determineNextAction(input);
  
  return {
    title: input.hypothesisTitle,
    why: whyBullets,
    known: input.knowns,
    unknown: input.unknowns,
    nextAction: {
      action: nextAction.action,
      type: nextAction.type,
      cost: nextAction.cost,
    },
  };
}

/**
 * Combine decision calculation with explanation generation
 */
export function generateFullDecision(input: DecisionInput): DecisionResult {
  const decisionWithoutExplanation = calculateDecision(input);
  
  const explanation = generateExplanation(
    input,
    decisionWithoutExplanation.scores,
    decisionWithoutExplanation.priority
  );
  
  return {
    ...decisionWithoutExplanation,
    explanation,
  };
}
