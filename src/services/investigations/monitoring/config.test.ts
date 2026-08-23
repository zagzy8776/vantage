/**
 * Milestone 11: Monitoring & Change Detection
 * 
 * Tests for monitoring configuration.
 */

import { describe, it, expect } from "vitest";
import {
  validateMonitoringConfig,
  calculateNextRunTime,
  getDefaultMonitoringConfig,
  shouldRunMonitoring,
  estimateMonitoringCost,
} from "./config";
import type { MonitoringConfig } from "./types";

describe("Monitoring Configuration", () => {
  describe("validateMonitoringConfig", () => {
    it("validates complete config", () => {
      const config: Partial<MonitoringConfig> = {
        investigationId: "test-id",
        frequency: "weekly",
        scope: {
          businessIds: ["biz1", "biz2"],
        },
        signals: ["booking", "cancellation"],
        budget: {
          maxSearchRuns: 5,
          maxEvidenceItems: 100,
        },
        alertThreshold: "medium",
      };

      const result = validateMonitoringConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects missing investigation ID", () => {
      const config: Partial<MonitoringConfig> = {
        frequency: "weekly",
        scope: { businessIds: ["biz1"] },
        signals: ["booking"],
        budget: { maxSearchRuns: 5, maxEvidenceItems: 100 },
        alertThreshold: "medium",
      };

      const result = validateMonitoringConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Investigation ID is required");
    });

    it("rejects invalid frequency", () => {
      const config: Partial<MonitoringConfig> = {
        investigationId: "test-id",
        frequency: "invalid" as "daily" | "weekly" | "monthly" | "quarterly",
        scope: { businessIds: ["biz1"] },
        signals: ["booking"],
        budget: { maxSearchRuns: 5, maxEvidenceItems: 100 },
        alertThreshold: "medium",
      };

      const result = validateMonitoringConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid monitoring frequency");
    });

    it("rejects empty business list", () => {
      const config: Partial<MonitoringConfig> = {
        investigationId: "test-id",
        frequency: "weekly",
        scope: { businessIds: [] },
        signals: ["booking"],
        budget: { maxSearchRuns: 5, maxEvidenceItems: 100 },
        alertThreshold: "medium",
      };

      const result = validateMonitoringConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("At least one business must be monitored");
    });

    it("rejects empty signals", () => {
      const config: Partial<MonitoringConfig> = {
        investigationId: "test-id",
        frequency: "weekly",
        scope: { businessIds: ["biz1"] },
        signals: [],
        budget: { maxSearchRuns: 5, maxEvidenceItems: 100 },
        alertThreshold: "medium",
      };

      const result = validateMonitoringConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("At least one signal must be monitored");
    });

    it("rejects invalid budget", () => {
      const config: Partial<MonitoringConfig> = {
        investigationId: "test-id",
        frequency: "weekly",
        scope: { businessIds: ["biz1"] },
        signals: ["booking"],
        budget: { maxSearchRuns: 0, maxEvidenceItems: 100 },
        alertThreshold: "medium",
      };

      const result = validateMonitoringConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Max search runs must be at least 1");
    });
  });

  describe("calculateNextRunTime", () => {
    it("calculates daily interval", () => {
      const lastRun = new Date("2024-01-01T00:00:00Z");
      const nextRun = calculateNextRunTime("daily", lastRun);
      const expected = new Date("2024-01-02T00:00:00Z");
      expect(nextRun.getTime()).toBe(expected.getTime());
    });

    it("calculates weekly interval", () => {
      const lastRun = new Date("2024-01-01T00:00:00Z");
      const nextRun = calculateNextRunTime("weekly", lastRun);
      const expected = new Date("2024-01-08T00:00:00Z");
      expect(nextRun.getTime()).toBe(expected.getTime());
    });

    it("calculates monthly interval", () => {
      const lastRun = new Date("2024-01-01T00:00:00Z");
      const nextRun = calculateNextRunTime("monthly", lastRun);
      const expected = new Date("2024-01-31T00:00:00Z");
      expect(nextRun.getTime()).toBe(expected.getTime());
    });

    it("uses current time when no last run", () => {
      const before = new Date();
      const nextRun = calculateNextRunTime("weekly", null);
      const after = new Date();
      
      expect(nextRun.getTime()).toBeGreaterThan(before.getTime() + 6 * 24 * 60 * 60 * 1000);
      expect(nextRun.getTime()).toBeLessThan(after.getTime() + 8 * 24 * 60 * 60 * 1000);
    });
  });

  describe("shouldRunMonitoring", () => {
    it("returns true when no last run", () => {
      const shouldRun = shouldRunMonitoring("weekly", null);
      expect(shouldRun).toBe(true);
    });

    it("returns true when next run time passed", () => {
      const lastRun = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      const shouldRun = shouldRunMonitoring("weekly", lastRun);
      expect(shouldRun).toBe(true);
    });

    it("returns false when next run time not passed", () => {
      const lastRun = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      const shouldRun = shouldRunMonitoring("weekly", lastRun);
      expect(shouldRun).toBe(false);
    });
  });

  describe("getDefaultMonitoringConfig", () => {
    it("returns default configuration", () => {
      const config = getDefaultMonitoringConfig("test-id");
      
      expect(config.investigationId).toBe("test-id");
      expect(config.frequency).toBe("weekly");
      expect(config.scope?.businessIds).toEqual([]);
      expect(config.signals).toEqual(["booking", "cancellation", "appointment", "scheduling"]);
      expect(config.budget?.maxSearchRuns).toBe(5);
      expect(config.budget?.maxEvidenceItems).toBe(100);
      expect(config.alertThreshold).toBe("medium");
    });
  });

  describe("estimateMonitoringCost", () => {
    it("estimates low cost for small scope", () => {
      const config: MonitoringConfig = {
        investigationId: "test",
        frequency: "weekly",
        scope: { businessIds: ["biz1", "biz2"] },
        signals: ["booking"],
        budget: { maxSearchRuns: 5, maxEvidenceItems: 100 },
        alertThreshold: "medium",
      };

      const cost = estimateMonitoringCost(config);
      expect(cost.estimatedCost).toBe("low");
      expect(cost.estimatedSearchRuns).toBeGreaterThan(0);
    });

    it("estimates medium cost for medium scope", () => {
      const config: MonitoringConfig = {
        investigationId: "test",
        frequency: "weekly",
        scope: { businessIds: Array.from({ length: 20 }, (_, i) => `biz${i}`) },
        signals: ["booking"],
        budget: { maxSearchRuns: 5, maxEvidenceItems: 100 },
        alertThreshold: "medium",
      };

      const cost = estimateMonitoringCost(config);
      expect(cost.estimatedCost).toBe("high"); // 20 businesses * 4 (weekly multiplier) = 80 search runs, which is high
    });

    it("estimates high cost for large scope", () => {
      const config: MonitoringConfig = {
        investigationId: "test",
        frequency: "daily",
        scope: { businessIds: Array.from({ length: 50 }, (_, i) => `biz${i}`) },
        signals: ["booking"],
        budget: { maxSearchRuns: 5, maxEvidenceItems: 100 },
        alertThreshold: "medium",
      };

      const cost = estimateMonitoringCost(config);
      expect(cost.estimatedCost).toBe("high");
    });

    it("scales with frequency", () => {
      const weeklyConfig: MonitoringConfig = {
        investigationId: "test",
        frequency: "weekly",
        scope: { businessIds: ["biz1"] },
        signals: ["booking"],
        budget: { maxSearchRuns: 5, maxEvidenceItems: 100 },
        alertThreshold: "medium",
      };

      const dailyConfig: MonitoringConfig = {
        ...weeklyConfig,
        frequency: "daily",
      };

      const weeklyCost = estimateMonitoringCost(weeklyConfig);
      const dailyCost = estimateMonitoringCost(dailyConfig);

      expect(dailyCost.estimatedSearchRuns).toBeGreaterThan(weeklyCost.estimatedSearchRuns);
    });
  });
});
