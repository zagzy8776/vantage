/**
 * Milestone 10: Explainable Opportunity Decision Layer
 * 
 * Tests for deterministic scoring rules.
 */

import { describe, it, expect } from "vitest";
import {
  calculateEvidenceStrength,
  calculateAffectedBusinessReach,
  calculateConfidence,
  calculateValidationEase,
  calculateUnknownPenalty,
  calculateContradictionPenalty,
  calculateScores,
} from "./scoring";
import type { DecisionInput } from "./types";

describe("Decision Scoring", () => {
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

  describe("calculateEvidenceStrength", () => {
    it("calculates score with medium evidence quality", () => {
      const score = calculateEvidenceStrength(baseInput);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("gives higher score for high quality evidence", () => {
      const highQuality = { ...baseInput, evidenceQuality: "high" as const };
      const lowQuality = { ...baseInput, evidenceQuality: "low" as const };
      
      const highScore = calculateEvidenceStrength(highQuality);
      const lowScore = calculateEvidenceStrength(lowQuality);
      
      expect(highScore).toBeGreaterThan(lowScore);
    });

    it("increases with more evidence", () => {
      const fewEvidence = { ...baseInput, evidenceCount: 1 };
      const manyEvidence = { ...baseInput, evidenceCount: 10 };
      
      const fewScore = calculateEvidenceStrength(fewEvidence);
      const manyScore = calculateEvidenceStrength(manyEvidence);
      
      expect(manyScore).toBeGreaterThan(fewScore);
    });

    it("increases with higher business reach", () => {
      const lowReach = { ...baseInput, affectedBusinesses: 1, totalBusinesses: 10 };
      const highReach = { ...baseInput, affectedBusinesses: 8, totalBusinesses: 10 };
      
      const lowScore = calculateEvidenceStrength(lowReach);
      const highScore = calculateEvidenceStrength(highReach);
      
      expect(highScore).toBeGreaterThan(lowScore);
    });

    it("caps at 100", () => {
      const maxInput = {
        ...baseInput,
        evidenceCount: 100,
        evidenceQuality: "high" as const,
        affectedBusinesses: 10,
        totalBusinesses: 10,
      };
      
      const score = calculateEvidenceStrength(maxInput);
      expect(score).toBe(100);
    });

    it("returns 0 for no businesses", () => {
      const noBusinesses = { ...baseInput, totalBusinesses: 0 };
      const score = calculateEvidenceStrength(noBusinesses);
      expect(score).toBe(0);
    });
  });

  describe("calculateAffectedBusinessReach", () => {
    it("calculates score based on ratio", () => {
      const score = calculateAffectedBusinessReach(baseInput);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("gives low score for small ratio", () => {
      const lowRatio = { ...baseInput, affectedBusinesses: 1, totalBusinesses: 100 };
      const score = calculateAffectedBusinessReach(lowRatio);
      expect(score).toBeLessThan(30);
    });

    it("gives high score for large ratio", () => {
      const highRatio = { ...baseInput, affectedBusinesses: 8, totalBusinesses: 10 };
      const score = calculateAffectedBusinessReach(highRatio);
      expect(score).toBeGreaterThan(60);
    });

    it("returns 0 for no businesses", () => {
      const noBusinesses = { ...baseInput, totalBusinesses: 0 };
      const score = calculateAffectedBusinessReach(noBusinesses);
      expect(score).toBe(0);
    });

    it("returns 100 for all businesses affected", () => {
      const allAffected = { ...baseInput, affectedBusinesses: 10, totalBusinesses: 10 };
      const score = calculateAffectedBusinessReach(allAffected);
      expect(score).toBe(100); // Capped at 100
    });
  });

  describe("calculateConfidence", () => {
    it("uses base confidence score", () => {
      const score = calculateConfidence(baseInput);
      expect(score).toBeLessThanOrEqual(baseInput.confidenceScore);
    });

    it("reduces confidence for unknowns", () => {
      const noUnknowns = { ...baseInput, unknowns: [] };
      const manyUnknowns = { ...baseInput, unknowns: ["a", "b", "c", "d", "e"] };
      
      const noUnknownsScore = calculateConfidence(noUnknowns);
      const manyUnknownsScore = calculateConfidence(manyUnknowns);
      
      expect(noUnknownsScore).toBeGreaterThan(manyUnknownsScore);
    });

    it("caps unknown penalty at 30", () => {
      const manyUnknowns = { ...baseInput, unknowns: Array(20).fill("unknown") };
      const score = calculateConfidence(manyUnknowns);
      expect(score).toBeGreaterThanOrEqual(baseInput.confidenceScore - 30);
    });

    it("caps at 100", () => {
      const highConfidence = { ...baseInput, confidenceScore: 100, unknowns: [] };
      const score = calculateConfidence(highConfidence);
      expect(score).toBe(100);
    });

    it("caps at 0", () => {
      const lowConfidence = { ...baseInput, confidenceScore: 10, unknowns: Array(20).fill("unknown") };
      const score = calculateConfidence(lowConfidence);
      expect(score).toBe(0);
    });
  });

  describe("calculateValidationEase", () => {
    it("gives high score for low complexity and low cost", () => {
      const easy = {
        ...baseInput,
        validationComplexity: "low" as const,
        estimatedValidationCost: "LOW" as const,
      };
      const score = calculateValidationEase(easy);
      expect(score).toBeGreaterThan(70);
    });

    it("gives low score for high complexity and high cost", () => {
      const hard = {
        ...baseInput,
        validationComplexity: "high" as const,
        estimatedValidationCost: "HIGH" as const,
      };
      const score = calculateValidationEase(hard);
      expect(score).toBeLessThan(30);
    });

    it("caps at 100", () => {
      const easiest = {
        ...baseInput,
        validationComplexity: "low" as const,
        estimatedValidationCost: "LOW" as const,
      };
      const score = calculateValidationEase(easiest);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("caps at 0", () => {
      const hardest = {
        ...baseInput,
        validationComplexity: "high" as const,
        estimatedValidationCost: "HIGH" as const,
      };
      const score = calculateValidationEase(hardest);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateUnknownPenalty", () => {
    it("returns 0 for no unknowns", () => {
      const noUnknowns = { ...baseInput, unknowns: [] };
      const penalty = calculateUnknownPenalty(noUnknowns);
      expect(penalty).toBe(0);
    });

    it("increases with more unknowns", () => {
      const fewUnknowns = { ...baseInput, unknowns: ["a"] };
      const manyUnknowns = { ...baseInput, unknowns: ["a", "b", "c"] };
      
      const fewPenalty = calculateUnknownPenalty(fewUnknowns);
      const manyPenalty = calculateUnknownPenalty(manyUnknowns);
      
      expect(manyPenalty).toBeGreaterThan(fewPenalty);
    });

    it("caps at 50", () => {
      const manyUnknowns = { ...baseInput, unknowns: Array(20).fill("unknown") };
      const penalty = calculateUnknownPenalty(manyUnknowns);
      expect(penalty).toBe(50);
    });

    it("adds 10 points per unknown", () => {
      const threeUnknowns = { ...baseInput, unknowns: ["a", "b", "c"] };
      const penalty = calculateUnknownPenalty(threeUnknowns);
      expect(penalty).toBe(30);
    });
  });

  describe("calculateContradictionPenalty", () => {
    it("returns 0 for no contradictions", () => {
      const noContradictions = { ...baseInput, hasContradictions: false };
      const penalty = calculateContradictionPenalty(noContradictions);
      expect(penalty).toBe(0);
    });

    it("returns 0 when hasContradictions is false even with count", () => {
      const inconsistent = { ...baseInput, hasContradictions: false, contradictionCount: 5 };
      const penalty = calculateContradictionPenalty(inconsistent);
      expect(penalty).toBe(0);
    });

    it("increases with more contradictions", () => {
      const oneContradiction = { ...baseInput, hasContradictions: true, contradictionCount: 1 };
      const twoContradictions = { ...baseInput, hasContradictions: true, contradictionCount: 2 };
      
      const onePenalty = calculateContradictionPenalty(oneContradiction);
      const twoPenalty = calculateContradictionPenalty(twoContradictions);
      
      expect(twoPenalty).toBeGreaterThan(onePenalty);
    });

    it("adds 25 points per contradiction", () => {
      const twoContradictions = { ...baseInput, hasContradictions: true, contradictionCount: 2 };
      const penalty = calculateContradictionPenalty(twoContradictions);
      expect(penalty).toBe(50);
    });

    it("caps at 100", () => {
      const manyContradictions = { ...baseInput, hasContradictions: true, contradictionCount: 10 };
      const penalty = calculateContradictionPenalty(manyContradictions);
      expect(penalty).toBe(100);
    });
  });

  describe("calculateScores", () => {
    it("calculates all scores", () => {
      const scores = calculateScores(baseInput);
      
      expect(scores).toHaveProperty("evidenceStrength");
      expect(scores).toHaveProperty("affectedBusinessReach");
      expect(scores).toHaveProperty("confidence");
      expect(scores).toHaveProperty("validationEase");
      expect(scores).toHaveProperty("unknownPenalty");
      expect(scores).toHaveProperty("contradictionPenalty");
      
      // All scores should be between 0 and 100
      Object.values(scores).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    it("produces consistent results", () => {
      const scores1 = calculateScores(baseInput);
      const scores2 = calculateScores(baseInput);
      
      expect(scores1).toEqual(scores2);
    });
  });
});
