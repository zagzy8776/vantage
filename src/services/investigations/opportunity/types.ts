import type { EconomicHypothesis, InvestigationActionType } from "@/services/investigations/types";

export const PROBLEM_CATEGORIES = [
  "missed_followups", "appointment_no_shows", "order_management", "inventory_discrepancy", "payment_collection", "invoice_followup", "manual_reconciliation", "customer_retention", "delivery_failure", "staff_visibility", "pricing_management", "supplier_management", "workflow_fragmentation", "reporting_visibility",
] as const;
export type ProblemCategory = typeof PROBLEM_CATEGORIES[number];
export type SignalState = "observed" | "derived" | "hypothesis" | "unknown";

export interface ProblemSignalDefinition {
  id: string;
  label: string;
  categories: string[];
  synonyms: string[];
  interpretation: string;
}

export interface ProblemSignal {
  id: string;
  label: string;
  state: SignalState;
  businessIds: string[];
  evidenceIds: string[];
  summary: string;
}

export interface OpportunityInvestigationInput {
  objective: string;
  problemCategory?: ProblemCategory;
  serviceCategory?: string;
  industry?: string;
  geography?: { country?: string; region?: string; city?: string };
  criteria?: Record<string, unknown>;
}

export interface OpportunityInvestigationContext {
  input: OpportunityInvestigationInput;
  sampleSize: number;
  businesses: Array<{ businessId: string; name: string; category: string | null }>;
  signals: ProblemSignal[];
  evidence: Array<{ id: string; businessId: string; statement: string; category: string; sourceType: string }>;
  unknowns: string[];
}

export interface OpportunityFindingDraft {
  title: string;
  summary: string;
  confidence: number;
  businessIds: string[];
  evidenceIds: string[];
  claimIds: string[];
  unknowns: string[];
  status: "supported" | "requires_review";
}

export interface OpportunityHypothesisDraft {
  title: string;
  statement: string;
  confidence: number;
  businessIds: string[];
  evidenceIds: string[];
  riskSummary: string;
  assumptions: string[];
  economicHypothesis?: EconomicHypothesis;
  status: "hypothesis" | "needs_validation";
}

export interface OpportunityActionDraft { title: string; description: string; priority: "low" | "medium" | "high"; actionType: InvestigationActionType }
export interface OpportunitySynthesisResult { executiveSummary: string; findings: OpportunityFindingDraft[]; opportunities: OpportunityHypothesisDraft[]; unknowns: string[]; recommendedActions: OpportunityActionDraft[] }
export interface OpportunityValidationIssue { type: string; path: string; message: string; value?: unknown }
export interface OpportunityValidationResult { status: "supported" | "requires_review" | "rejected"; issues: OpportunityValidationIssue[]; result: OpportunitySynthesisResult }