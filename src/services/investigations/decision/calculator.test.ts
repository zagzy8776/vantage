/**
 * Milestone 10: Explainable Opportunity Decision Layer
 * 
 * Tests for priority calculation logic.
 */

import { describe, it, expect } from "vitest";
import {
  calculateRawScore,
  scoreToPriority,
  generateCalculationFormula,
  calculateDecision,
} from "./calculator";
import { calculateScores } from "./scoring";
import type { DecisionInput } from "./types";

describe("Decision Calculator", () => {
  const baseInput: DecisionInput = {
    totalBusinesses: 10,
    affectedBusinesses: 5,
    evidenceCount: 3,
    evidenceQuality: "medium",
    confidenceScore: 70,
    knowns: ["booking workflow exists"],
    unknowns: ["actual no-show rate"],
    hasContradictions: false,
    contradictionCount: 0,
    validationComplexity: "medium",
    estimatedValidationCost: "MEDIUM",
    hypothesisTitle: "Test hypothesis",
    hypothesisStatement: "Test statement",
  };

  describe("calculateRawScore", () => {
    it("calculates weighted score", () => {
      const scores = calculateScores(baseInput);
      const rawScore = calculateRawScore(scores);
      
      expect(rawScore).toBeGreaterThanOrEqual(0);
      expect(rawScore).toBeLessThanOrEqual(100);
    });

    it("caps at 100", () => {
      const highScores = {
        evidenceStrength: 100,
        affectedBusinessReach: 100,
        confidence: 100,
        validationEase: 100,
        unknownPenalty: 0,
        contradictionPenalty: 0,
      };
      const rawScore = calculateRawScore(highScores);
      expect(rawScore).toBe(90);
    });

    it("caps at 0", () => {
      const lowScores = {
        evidenceStrength: 0,
        affectedBusinessReach: 0,
        confidence: 0,
        validationEase: 0,
        unknownPenalty: 50,
        contradictionPenalty: 50,
      };
      const rawScore = calculateRawScore(lowScores);
      expect(rawScore).toBe(0);
    });

    it("subtracts penalties", () => {
      const scores = calculateScores(baseInput);
      const scoresWithPenalties = {
        ...scores,
        unknownPenalty: 20,
        contradictionPenalty: 10,
      };
      
      const scoreWithoutPenalties = calculateRawScore({
        ...scoresWithPenalties,
        unknownPenalty: 0,
        contradictionPenalty: 0,
      });
      const scoreWithPenalties = calculateRawScore(scoresWithPenalties);
      
      expect(scoreWithoutPenalties).toBeGreaterThan(scoreWithPenalties);
    });
  });

  describe("scoreToPriority", () => {
    it("returns CRITICAL for scores >= 75", () => {
      expect(scoreToPriority(75)).toBe("CRITICAL");
      expect(scoreToPriority(80)).toBe("CRITICAL");
      expect(scoreToPriority(100)).toBe("CRITICAL");
    });

    it("returns HIGH for scores >= 55 and < 75", () => {
      expect(scoreToPriority(55)).toBe("HIGH");
      expect(scoreToPriority(60)).toBe("HIGH");
      expect(scoreToPriority(74)).toBe("HIGH");
    });

    it("returns MEDIUM for scores >= 35 and < 55", () => {
      expect(scoreToPriority(35)).toBe("MEDIUM");
      expect(scoreToPriority(45)).toBe("MEDIUM");
      expect(scoreToPriority(54)).toBe("MEDIUM");
    });

    it("returns LOW for scores < 35", () => {
      expect(scoreToPriority(0)).toBe("LOW");
      expect(scoreToPriority(20)).toBe("LOW");
      expect(scoreToPriority(34)).toBe("LOW");
    });

    it("handles edge cases", () => {
      expect(scoreToPriority(74.9)).toBe("HIGH");
      expect(scoreToPriority(54.9)).toBe("MEDIUM");
      expect(scoreToPriority(34.9)).toBe("LOW");
    });
  });

  describe("generateCalculationFormula", () => {
    it("generates formula string", () => {
      const scores = calculateScores(baseInput);
      const formula = generateCalculationFormula(scores);
      
      expect(formula).toContain("× 0.3");
      expect(formula).toContain("× 0.2");
      expect(formula).toContain("× 0.25");
      expect(formula).toContain("× 0.15");
      expect(formula).toContain("=");
    });

    it("includes actual score values", () => {
      const scores = calculateScores(baseInput);
      const formula = generateCalculationFormula(scores);
      
      expect(formula).toContain(String(scores.evidenceStrength));
      expect(formula).toContain(String(scores.affectedBusinessReach));
      expect(formula).toContain(String(scores.confidence));
      expect(formula).toContain(String(scores.validationEase));
    });

    it("includes penalties when present", () => {
      const scores = calculateScores(baseInput);
      const scoresWithPenalties = {
        ...scores,
        unknownPenalty: 20,
        contradictionPenalty: 10,
      };
      const formula = generateCalculationFormula(scoresWithPenalties);
      
      expect(formula).toContain("- 20");
      expect(formula).toContain("- 10");
    });
  });

  describe("calculateDecision", () => {
    it("calculates full decision result", () => {
      const decision = calculateDecision(baseInput);
      
      expect(decision).toHaveProperty("priority");
      expect(decision).toHaveProperty("rawScore");
      expect(decision).toHaveProperty("scores");
      expect(decision).toHaveProperty("breakdown");
      
      expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(decision.priority);
      expect(decision.rawScore).toBeGreaterThanOrEqual(0);
      expect(decision.rawScore).toBeLessThanOrEqual(100);
    });

    it("includes breakdown with formula", () => {
      const decision = calculateDecision(baseInput);
      
      expect(decision.breakdown).toHaveProperty("evidenceStrength");
      expect(decision.breakdown).toHaveProperty("affectedBusinessReach");
      expect(decision.breakdown).toHaveProperty("confidence");
      expect(decision.breakdown).toHaveProperty("validationEase");
      expect(decision.breakdown).toHaveProperty("unknownPenalty");
      expect(decision.breakdown).toHaveProperty("contradictionPenalty");
      expect(decision.breakdown).toHaveProperty("calculation");
      
      expect(decision.breakdown.calculation).toContain("=");
    });

    it("produces consistent results", () => {
      const decision1 = calculateDecision(baseInput);
      const decision2 = calculateDecision(baseInput);
      
      expect(decision1.priority).toBe(decision2.priority);
      expect(decision1.rawScore).toBe(decision2.rawScore);
      expect(decision1.scores).toEqual(decision2.scores);
    });

    it("gives higher priority for stronger evidence", () => {
      const weakEvidence = { ...baseInput, evidenceCount: 1, evidenceQuality: "low" as const };
      const strongEvidence = { ...baseInput, evidenceCount: 10, evidenceQuality: "high" as const };
      
      const weakDecision = calculateDecision(weakEvidence);
      const strongDecision = calculateDecision(strongEvidence);
      
      expect(strongDecision.rawScore).toBeGreaterThan(weakDecision.rawScore);
    });

    it("penalizes unknowns", () => {
      const noUnknowns = { ...baseInput, unknowns: [] };
      const manyUnknowns = { ...baseInput, unknowns: ["a", "b", "c", "d", "e"] };
      
      const noUnknownsDecision = calculateDecision(noUnknowns);
      const manyUnknownsDecision = calculateDecision(manyUnknowns);
      
      expect(noUnknownsDecision.rawScore).toBeGreaterThan(manyUnknownsDecision.rawScore);
    });

    it("penalizes contradictions", () => {
      const noContradictions = { ...baseInput, hasContradictions: false, contradictionCount: 0 };
      const withContradictions = { ...baseInput, hasContradictions: true, contradictionCount: 2 };
      
      const noContradictionsDecision = calculateDecision(noContradictions);
      const withContradictionsDecision = calculateDecision(withContradictions);
      
      expect(noContradictionsDecision.rawScore).toBeGreaterThan(withContradictionsDecision.rawScore);
    });
  });
});
