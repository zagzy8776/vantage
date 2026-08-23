/**
 * Milestone 11: Monitoring & Change Detection
 * 
 * Types for monitoring investigations and detecting meaningful changes.
 */

export type ChangeType = "new" | "changed" | "removed" | "unchanged" | "uncertain";
export type ChangeSignificance = "low" | "medium" | "high" | "critical";
export type MonitoringStatus = "active" | "paused" | "stopped" | "error";
export type MonitoringFrequency = "daily" | "weekly" | "monthly" | "quarterly";

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  investigationId: string;
  frequency: MonitoringFrequency;
  scope: {
    businessIds: string[];
    geography?: {
      country?: string;
      region?: string;
      city?: string;
    };
    industry?: string;
  };
  signals: string[]; // Signal types to monitor
  budget: {
    maxSearchRuns: number;
    maxEvidenceItems: number;
  };
  alertThreshold: ChangeSignificance; // Minimum significance to trigger alert
}

/**
 * Evidence diff between two observations
 */
export interface EvidenceDiff {
  evidenceId: string;
  businessId: string;
  changeType: ChangeType;
  before: {
    statement: string | null;
    category: string | null;
    sourceUrl: string | null;
    observedAt: Date | null;
  };
  after: {
    statement: string | null;
    category: string | null;
    sourceUrl: string | null;
    observedAt: Date | null;
  };
  source: string;
  detectedAt: Date;
}

/**
 * Change detection result
 */
export interface ChangeDetectionResult {
  monitoringId: string;
  investigationId: string;
  detectedAt: Date;
  summary: {
    totalChanges: number;
    byType: Record<ChangeType, number>;
    bySignificance: Record<ChangeSignificance, number>;
  };
  changes: Array<{
    changeType: ChangeType;
    significance: ChangeSignificance;
    description: string;
    businessId: string;
    businessName: string;
    evidenceDiffs: EvidenceDiff[];
  }>;
}

/**
 * Monitoring run
 */
export interface MonitoringRun {
  id: string;
  monitoringId: string;
  investigationId: string;
  status: "running" | "completed" | "failed";
  startedAt: Date;
  completedAt: Date | null;
  changesDetected: number;
  significantChanges: number;
  error: string | null;
}

/**
 * Change review status
 */
export type ReviewStatus = "pending" | "approved" | "rejected" | "needs_investigation";

/**
 * Change review item
 */
export interface ChangeReview {
  id: string;
  monitoringRunId: string;
  changeId: string;
  status: ReviewStatus;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  notes: string | null;
  actionTaken: "accepted" | "rejected" | "investigated" | null;
}
