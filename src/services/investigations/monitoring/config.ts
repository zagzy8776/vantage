/**
 * Milestone 11: Monitoring & Change Detection
 * 
 * Monitoring configuration service.
 */

import type { MonitoringConfig, MonitoringFrequency } from "./types";

/**
 * Validate monitoring configuration
 */
export function validateMonitoringConfig(config: Partial<MonitoringConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.investigationId) {
    errors.push("Investigation ID is required");
  }

  if (!config.frequency) {
    errors.push("Monitoring frequency is required");
  } else if (!["daily", "weekly", "monthly", "quarterly"].includes(config.frequency)) {
    errors.push("Invalid monitoring frequency");
  }

  if (!config.scope) {
    errors.push("Monitoring scope is required");
  } else {
    if (!config.scope.businessIds || config.scope.businessIds.length === 0) {
      errors.push("At least one business must be monitored");
    }
  }

  if (!config.signals || config.signals.length === 0) {
    errors.push("At least one signal must be monitored");
  }

  if (!config.budget) {
    errors.push("Budget configuration is required");
  } else {
    if (!config.budget.maxSearchRuns || config.budget.maxSearchRuns < 1) {
      errors.push("Max search runs must be at least 1");
    }
    if (!config.budget.maxEvidenceItems || config.budget.maxEvidenceItems < 1) {
      errors.push("Max evidence items must be at least 1");
    }
  }

  if (!config.alertThreshold) {
    errors.push("Alert threshold is required");
  } else if (!["low", "medium", "high", "critical"].includes(config.alertThreshold)) {
    errors.push("Invalid alert threshold");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate next run time based on frequency
 */
export function calculateNextRunTime(
  frequency: MonitoringFrequency,
  lastRunAt: Date | null
): Date {
  const now = new Date();
  const base = lastRunAt || now;

  switch (frequency) {
    case "daily":
      return new Date(base.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "monthly":
      return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    case "quarterly":
      return new Date(base.getTime() + 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Get default monitoring configuration for an investigation
 */
export function getDefaultMonitoringConfig(investigationId: string): Partial<MonitoringConfig> {
  return {
    investigationId,
    frequency: "weekly",
    scope: {
      businessIds: [],
    },
    signals: ["booking", "cancellation", "appointment", "scheduling"],
    budget: {
      maxSearchRuns: 5,
      maxEvidenceItems: 100,
    },
    alertThreshold: "medium",
  };
}

/**
 * Check if monitoring should run based on schedule
 */
export function shouldRunMonitoring(
  frequency: MonitoringFrequency,
  lastRunAt: Date | null
): boolean {
  if (!lastRunAt) return true;

  const nextRunTime = calculateNextRunTime(frequency, lastRunAt);
  return new Date() >= nextRunTime;
}

/**
 * Estimate monitoring cost
 */
export function estimateMonitoringCost(config: MonitoringConfig): {
  estimatedSearchRuns: number;
  estimatedEvidenceItems: number;
  estimatedCost: "low" | "medium" | "high";
} {
  const businessCount = config.scope.businessIds.length;
  const frequencyMultiplier = {
    daily: 30,
    weekly: 4,
    monthly: 1,
    quarterly: 0.33,
  }[config.frequency];

  const estimatedSearchRuns = Math.ceil(businessCount * frequencyMultiplier);
  const estimatedEvidenceItems = Math.ceil(
    estimatedSearchRuns * (config.budget.maxEvidenceItems / config.budget.maxSearchRuns)
  );

  let estimatedCost: "low" | "medium" | "high";
  if (estimatedSearchRuns <= 10) {
    estimatedCost = "low";
  } else if (estimatedSearchRuns <= 50) {
    estimatedCost = "medium";
  } else {
    estimatedCost = "high";
  }

  return {
    estimatedSearchRuns,
    estimatedEvidenceItems,
    estimatedCost,
  };
}
