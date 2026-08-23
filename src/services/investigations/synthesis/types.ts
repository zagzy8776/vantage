import type {
  InvestigationActionType,
  InvestigationFindingType,
  InvestigationOpportunityStatus,
} from "@/services/investigations/types";

export type SynthesisPriority = "low" | "medium" | "high";

export interface InvestigationAggregates {
  businesses: {
    total: number;
    verified: number;
    likely: number;
    uncertain: number;
    rejected: number;
  };
  websites: {
    verified: number;
    likely: number;
    unknown: number;
    pageSpeedAnalyses: number;
    pageSpeedSuccessful: number;
    pageSpeedFailed: number;
  };
  evidence: {
    total: number;
    bySource: Record<string, number>;
    byCategory: Record<string, number>;
    byConfidence: Record<string, number>;
    freshness: { last7Days: number; last30Days: number; older: number };
  };
  ai: {
    total: number;
    supported: number;
    requiresReview: number;
    rejected: number;
    legacy: number;
    failed: number;
  };
  signals: Record<string, { evidenceCount: number; businessCount: number }>;
  claims: { total: number; supported: number; requiresReview: number; unknown: number; rejected: number };
  contradictions: { source: number; ai: number; total: number };
}

export interface SynthesisBusinessSample {
  businessId: string;
  name: string;
  category: string | null;
  city: string | null;
  country: string | null;
  verificationStatus: string;
  website: string | null;
}

export interface SynthesisEvidence {
  id: string;
  businessId: string;
  statement: string;
  value: string | null;
  category: string;
  sourceType: string;
  sourceUrl: string | null;
  confidence: string;
  observedAt: string;
}

export interface SynthesisClaim {
  id: string;
  businessId: string | null;
  claimType: string;
  statement: string;
  confidence: number | null;
  evidenceIds: string[];
  status: "supported" | "requires_review";
}

export interface SynthesisContradiction {
  id: string;
  category: "source" | "ai";
  businessId: string;
  statement: string;
  sourceTypes: string[];
  status: string;
}

export interface InvestigationSynthesisInput {
  investigation: {
    title: string;
    objective: string;
    investigationType: string;
    industry: string | null;
    geography: { country: string | null; region: string | null; city: string | null };
    criteria: Record<string, unknown> | null;
  };
  aggregates: InvestigationAggregates;
  businesses: SynthesisBusinessSample[];
  claims: SynthesisClaim[];
  evidence: SynthesisEvidence[];
  unknowns: string[];
  contradictions: SynthesisContradiction[];
}

export interface InvestigationSynthesisFindingDraft {
  title: string;
  summary: string;
  findingType: InvestigationFindingType;
  confidence: number;
  businessIds: string[];
  evidenceIds: string[];
  claimIds: string[];
  unknowns: string[];
}

export interface InvestigationSynthesisOpportunityDraft {
  title: string;
  statement: string;
  confidence: number;
  businessIds: string[];
  evidenceIds: string[];
  riskSummary: string;
  status: Extract<InvestigationOpportunityStatus, "hypothesis" | "needs_validation">;
}

export interface InvestigationSynthesisActionDraft {
  title: string;
  description: string;
  priority: SynthesisPriority;
  actionType: InvestigationActionType;
}

export interface InvestigationSynthesisResult {
  executiveSummary: string;
  findings: InvestigationSynthesisFindingDraft[];
  opportunities: InvestigationSynthesisOpportunityDraft[];
  risks: string[];
  unknowns: string[];
  recommendedActions: InvestigationSynthesisActionDraft[];
}

export interface SynthesisValidationIssue {
  type: string;
  path: string;
  message: string;
  value?: unknown;
}

export interface SynthesisValidationResult {
  status: "supported" | "requires_review" | "rejected";
  issues: SynthesisValidationIssue[];
  result: InvestigationSynthesisResult;
}

export interface SynthesisRunSummary {
  synthesisId: string;
  status: "running" | "completed" | "completed_with_errors" | "failed";
  validationStatus: "supported" | "requires_review" | "rejected";
  provider: string;
  model: string | null;
  findingsCreated: number;
  opportunitiesCreated: number;
  actionsCreated: number;
  issues: SynthesisValidationIssue[];
}