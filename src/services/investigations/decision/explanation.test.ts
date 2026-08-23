/**
 * Milestone 10: Explainable Opportunity Decision Layer
 * 
 * Tests for explanation generation from deterministic factors.
 */

import { describe, it, expect } from "vitest";
import {
  generateWhyBullets,
  determineNextAction,
  generateExplanation,
} from "./explanation";
import { calculateScores } from "./scoring";
import type { DecisionInput } from "./types";

describe("Explanation Generation", () => {
  const baseInput: DecisionInput = {
    totalBusinesses: 10,
    affectedBusinesses: 5,
    evidenceCount: 3,
    evidenceQuality: "medium",
    confidenceScore: 70,
    knowns: ["booking workflow exists", "cancellation policy exists"],
    unknowns: ["actual no-show rate", "revenue impact"],
    hasContradictions: false,
    contradictionCount: 0,
    validationComplexity: "medium",
    estimatedValidationCost: "MEDIUM",
    hypothesisTitle: "Appointment workflow optimization",
    hypothesisStatement: "Test statement",
  };

  describe("generateWhyBullets", () => {
    it("generates bullets from input", () => {
      const scores = calculateScores(baseInput);
      const bullets = generateWhyBullets(baseInput, scores);
      
      expect(bullets).toBeInstanceOf(Array);
      expect(bullets.length).toBeGreaterThan(0);
    });

    it("includes business reach", () => {
      const scores = calculateScores(baseInput);
      const bullets = generateWhyBullets(baseInput, scores);
      
      const reachBullet = bullets.find(b => b.includes("businesses"));
      expect(reachBullet).toBeDefined();
      expect(reachBullet).toContain("5 of 10");
    });

    it("includes evidence count", () => {
      const scores = calculateScores(baseInput);
      const bullets = generateWhyBullets(baseInput, scores);
      
      const evidenceBullet = bullets.find(b => b.includes("evidence"));
      expect(evidenceBullet).toBeDefined();
      expect(evidenceBullet).toContain("3");
    });

    it("includes confidence", () => {
      const scores = calculateScores(baseInput);
      const bullets = generateWhyBullets(baseInput, scores);
      
      const confidenceBullet = bullets.find(b => b.includes("confidence"));
      expect(confidenceBullet).toBeDefined();
    });

    it("mentions financial impact when unknown", () => {
      const scores = calculateScores(baseInput);
      const bullets = generateWhyBullets(baseInput, scores);
      
      const financialBullet = bullets.find(b => b.includes("financial"));
      expect(financialBullet).toBeDefined();
      expect(financialBullet).toContain("unknown");
    });

    it("includes validation effort", () => {
      const scores = calculateScores(baseInput);
      const bullets = generateWhyBullets(baseInput, scores);
      
      const validationBullet = bullets.find(b => b.includes("validation"));
      expect(validationBullet).toBeDefined();
    });

    it("mentions no contradictions when none", () => {
      const scores = calculateScores(baseInput);
      const bullets = generateWhyBullets(baseInput, scores);
      
      const contradictionBullet = bullets.find(b => b.includes("contradiction"));
      expect(contradictionBullet).toBeDefined();
      expect(contradictionBullet).toContain("no major contradiction");
    });

    it("mentions contradictions when present", () => {
      const inputWithContradictions = { ...baseInput, hasContradictions: true, contradictionCount: 2 };
      const scores = calculateScores(inputWithContradictions);
      const bullets = generateWhyBullets(inputWithContradictions, scores);
      
      const contradictionBullet = bullets.find(b => b.includes("contradiction"));
      expect(contradictionBullet).toBeDefined();
      expect(contradictionBullet).toContain("2");
    });
  });

  describe("determineNextAction", () => {
    it("recommends interviews for operational unknowns", () => {
      const input = {
        ...baseInput,
        unknowns: ["actual no-show rate", "process workflow", "policy effectiveness"],
        validationComplexity: "low" as const,
      };
      
      const action = determineNextAction(input);
      
      expect(action.type).toBe("interview");
      expect(action.action).toContain("Interview");
      expect(action.cost).toBe("LOW");
    });

    it("recommends research for financial unknowns", () => {
      const input = {
        ...baseInput,
        unknowns: ["revenue impact", "cost structure"],
        validationComplexity: "low" as const,
      };
      
      const action = determineNextAction(input);
      
      expect(action.type).toBe("research");
      expect(action.action).toContain("Research");
      expect(action.cost).toBe("LOW");
    });

    it("recommends verify for low complexity", () => {
      const input = {
        ...baseInput,
        unknowns: [],
        validationComplexity: "low" as const,
      };
      
      const action = determineNextAction(input);
      
      expect(action.type).toBe("verify");
      expect(action.cost).toBe("LOW");
    });

    it("recommends interviews for medium complexity", () => {
      const input = {
        ...baseInput,
        unknowns: [],
        validationComplexity: "medium" as const,
      };
      
      const action = determineNextAction(input);
      
      expect(action.type).toBe("interview");
      expect(action.cost).toBe("MEDIUM");
    });

    it("recommends data collection for high complexity", () => {
      const input = {
        ...baseInput,
        unknowns: [],
        validationComplexity: "high" as const,
      };
      
      const action = determineNextAction(input);
      
      expect(action.type).toBe("collect_data");
      expect(action.cost).toBe("HIGH");
    });

    it("scales interview count with unknowns", () => {
      const fewUnknowns = {
        ...baseInput,
        unknowns: ["rate"],
        validationComplexity: "low" as const,
      };
      const manyUnknowns = {
        ...baseInput,
        unknowns: ["rate", "process", "policy", "workflow", "cost"],
        validationComplexity: "low" as const,
      };
      
      const fewAction = determineNextAction(fewUnknowns);
      const manyAction = determineNextAction(manyUnknowns);
      
      expect(manyAction.action).toMatch(/\d+/);
      const manyCount = parseInt(manyAction.action.match(/\d+/)?.[0] || "0");
      const fewCount = parseInt(fewAction.action.match(/\d+/)?.[0] || "0");
      
      expect(manyCount).toBeGreaterThan(fewCount);
    });
  });

  describe("generateExplanation", () => {
    it("generates full explanation", () => {
      const scores = calculateScores(baseInput);
      const explanation = generateExplanation(baseInput, scores, "HIGH");
      
      expect(explanation).toHaveProperty("title");
      expect(explanation).toHaveProperty("why");
      expect(explanation).toHaveProperty("known");
      expect(explanation).toHaveProperty("unknown");
      expect(explanation).toHaveProperty("nextAction");
      
      expect(explanation.title).toBe(baseInput.hypothesisTitle);
      expect(explanation.known).toEqual(baseInput.knowns);
      expect(explanation.unknown).toEqual(baseInput.unknowns);
    });

    it("includes next action with type and cost", () => {
      const scores = calculateScores(baseInput);
      const explanation = generateExplanation(baseInput, scores, "HIGH");
      
      expect(explanation.nextAction).toHaveProperty("action");
      expect(explanation.nextAction).toHaveProperty("type");
      expect(explanation.nextAction).toHaveProperty("cost");
      
      expect(["interview", "research", "verify", "collect_data", "manual_review"]).toContain(
        explanation.nextAction.type
      );
      expect(["LOW", "MEDIUM", "HIGH"]).toContain(explanation.nextAction.cost);
    });

    it("generates why bullets", () => {
      const scores = calculateScores(baseInput);
      const explanation = generateExplanation(baseInput, scores, "HIGH");
      
      expect(explanation.why).toBeInstanceOf(Array);
      expect(explanation.why.length).toBeGreaterThan(0);
    });
  });
});
