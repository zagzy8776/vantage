import type { InvestigationActionType } from "@/services/investigations/types";

export type MarketPatternType = "market_pattern" | "digital_pattern" | "operational_signal" | "service_signal" | "risk_pattern" | "evidence_gap";
export type MarketClaimType = "fact" | "derived" | "inference" | "unknown";
export type MarketPatternStatus = "candidate" | "supported" | "requires_review" | "rejected";
export type MarketOpportunityStatus = "hypothesis" | "needs_validation";
export type MarketSynthesisStatus = "running" | "completed" | "completed_with_errors" | "failed";
export type MarketValidationStatus = "supported" | "requires_review" | "rejected" | "legacy";

export interface MarketAggregates {
  sampleSize: number;
  businesses: { total: number; verified: number; likely: number; uncertain: number; rejected: number };
  distinctBusinessSignals: {
    websites: number;
    booking: number;
    ecommerce: number;
    contact: number;
    social: number;
    pricing: number;
    services: number;
    pageSpeedAvailable: number;
    pageSpeedSuccessful: number;
    aiSupportedFindings: number;
    aiReviewFindings: number;
  };
  evidence: { total: number; sourceDiversity: number; bySource: Record<string, number>; byCategory: Record<string, number> };
  sampleLanguage: string;
}

export interface MarketEvidence {
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

export interface CandidateMarketPattern {
  id: string;
  title: string;
  summary: string;
  patternType: MarketPatternType;
  claimType: MarketClaimType;
  affectedBusinessIds: string[];
  evidenceIds: string[];
  confidence: number;
  status: "candidate";
}

export interface MarketSynthesisInput {
  investigation: { title: string; objective: string; industry: string | null; geography: { country: string | null; region: string | null; city: string | null }; criteria: Record<string, unknown> | null };
  aggregates: MarketAggregates;
  candidatePatterns: CandidateMarketPattern[];
  businesses: Array<{ businessId: string; name: string; category: string | null; city: string | null; country: string | null }>;
  evidence: MarketEvidence[];
  claims: Array<{ id: string; statement: string; evidenceIds: string[]; status: "supported" | "requires_review" }>;
  unknowns: string[];
  contradictions: Array<{ id: string; businessId: string; statement: string; status: string }>;
}

export interface MarketPatternDraft {
  title: string;
  summary: string;
  type: MarketPatternType;
  confidence: number;
  businessIds: string[];
  evidenceIds: string[];
  claimType: MarketClaimType;
  claimIds: string[];
  status: "supported" | "requires_review";
  unknowns: string[];
}

export interface MarketOpportunityDraft {
  title: string;
  statement: string;
  confidence: number;
  businessIds: string[];
  evidenceIds: string[];
  riskSummary: string;
  status: MarketOpportunityStatus;
}

export interface MarketActionDraft {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  actionType: InvestigationActionType;
}

export interface MarketSynthesisResult {
  executiveSummary: string;
  marketPatterns: MarketPatternDraft[];
  opportunities: MarketOpportunityDraft[];
  risks: string[];
  unknowns: string[];
  recommendedActions: MarketActionDraft[];
}

export interface MarketValidationIssue { type: string; path: string; message: string; value?: unknown }
export interface MarketValidationResult { status: MarketValidationStatus; issues: MarketValidationIssue[]; result: MarketSynthesisResult }
export interface MarketSynthesisSummary { synthesisId: string; status: MarketSynthesisStatus; validationStatus: MarketValidationStatus; provider: string; model: string | null; patternsCreated: number; opportunitiesCreated: number; actionsCreated: number; issues: MarketValidationIssue[] }