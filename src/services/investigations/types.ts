export type InvestigationType = "company" | "industry" | "market" | "problem" | "service_opportunity";
export type InvestigationStatus = "draft" | "active" | "completed" | "archived";
export type InvestigationSearchRunRole = "initial_discovery" | "refresh" | "supplemental" | "comparison";
export type InvestigationBusinessRole = "primary" | "comparison" | "candidate" | "excluded";
export type InvestigationClaimType = "fact" | "derived" | "inference" | "unknown";
export type InvestigationClaimStatus = "supported" | "requires_review" | "rejected";
export type InvestigationFindingType = "market_pattern" | "business_pattern" | "operational_signal" | "digital_signal" | "opportunity_signal" | "risk";
export type InvestigationOpportunityStatus = "hypothesis" | "needs_validation" | "supported" | "rejected";
export type InvestigationActionType = "verify" | "interview" | "research" | "compare" | "collect_data" | "manual_review";
export type InvestigationActionStatus = "todo" | "in_progress" | "completed" | "cancelled";
export type InvestigationSynthesisStatus = "running" | "completed" | "completed_with_errors" | "failed";
export type InvestigationSynthesisValidationStatus = "supported" | "requires_review" | "rejected" | "legacy";

export interface Investigation {
  id: string;
  title: string;
  objective: string;
  investigationType: InvestigationType;
  status: InvestigationStatus;
  industry: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  criteria: Record<string, unknown> | null;
  ownerId?: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationSearchRun {
  investigationId: string;
  searchRunId: string;
  role: InvestigationSearchRunRole;
  createdAt: Date;
}

export interface InvestigationBusiness {
  investigationId: string;
  businessId: string;
  role: InvestigationBusinessRole;
  includedReason: string | null;
  createdAt: Date;
}

export interface InvestigationSource {
  id: string;
  investigationId: string;
  searchRunId: string | null;
  provider: string;
  sourceUrl: string | null;
  sourceType: string;
  createdAt: Date;
}

export interface InvestigationClaim {
  id: string;
  investigationId: string;
  businessId: string | null;
  claimType: InvestigationClaimType;
  statement: string;
  confidence: number | null;
  evidenceIds: string[];
  status: InvestigationClaimStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationFinding {
  id: string;
  investigationId: string;
  title: string;
  summary: string;
  findingType: InvestigationFindingType;
  confidence: number | null;
  businessIds: string[];
  evidenceIds: string[];
  claimIds: string[];
  status: InvestigationClaimStatus;
  unknowns?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationOpportunity {
  id: string;
  investigationId: string;
  title: string;
  statement: string;
  confidence: number | null;
  businessIds: string[];
  evidenceIds: string[];
  riskSummary: string | null;
  status: InvestigationOpportunityStatus;
  economicHypothesis?: EconomicHypothesis | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EconomicImpactHypothesis {
  value?: number;
  currency?: string;
  basis: string;
  confidence: number;
}

export interface EconomicHypothesis {
  revenueImpact?: EconomicImpactHypothesis;
  costImpact?: EconomicImpactHypothesis;
  assumptions: string[];
}

export type OpportunityInvestigationMode = "company" | "industry" | "market" | "problem" | "service_opportunity" | "custom";

export interface OpportunityInvestigationInput {
  objective: string;
  problemCategory?: string;
  serviceCategory?: string;
  industry?: string;
  geography?: { country?: string; region?: string; city?: string };
  criteria?: Record<string, unknown>;
}

export interface InvestigationAction {
  id: string;
  investigationId: string;
  title: string;
  description: string | null;
  priority: number;
  actionType: InvestigationActionType;
  status: InvestigationActionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationNote {
  id: string;
  investigationId: string;
  author: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInvestigationInput {
  title: string;
  objective: string;
  investigationType: InvestigationType;
  searchRunId?: string;
  industry?: string;
  geography?: { country?: string; region?: string; city?: string };
  problemCategory?: string;
  serviceCategory?: string;
  researchQuestion?: string;
  criteria?: Record<string, unknown>;
}

export interface CreateStandaloneInvestigationInput {
  title: string;
  objective: string;
  investigationType: InvestigationType;
  industry?: string;
  geography: { country?: string; region?: string; city?: string };
  problemCategory?: string;
  serviceCategory?: string;
  researchQuestion?: string;
  criteria?: Record<string, unknown>;
}

export interface CreateStandaloneInvestigationResult {
  investigationId: string;
  planId: string;
  planVersion: number;
}

export interface InvestigationSummary {
  id: string;
  title: string;
  type: InvestigationType;
  status: InvestigationStatus;
  industry: string | null;
  country: string | null;
  city: string | null;
  objective: string;
  businessCount: number;
  searchRunCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationDetail extends Investigation {
  searchRuns: InvestigationSearchRun[];
  businesses: InvestigationBusiness[];
  sources: InvestigationSource[];
  claims: InvestigationClaim[];
  findings: InvestigationFinding[];
  opportunities: InvestigationOpportunity[];
  actions: InvestigationAction[];
  notes: InvestigationNote[];
  businessDetails: InvestigationBusinessSummary[];
  evidenceItems: InvestigationEvidenceItem[];
  sourceConflicts: InvestigationSourceConflict[];
  aiConflicts: InvestigationAiConflict[];
  runDetails: InvestigationRunSummary[];
  metrics: InvestigationMetrics;
  syntheses?: InvestigationSynthesisHistory[];
  marketSyntheses?: InvestigationMarketSynthesisHistory[];
  opportunitySyntheses?: InvestigationOpportunitySynthesisHistory[];
}

export interface InvestigationOpportunitySynthesisHistory {
  id: string;
  investigationId: string;
  provider: string;
  model: string | null;
  status: "running" | "completed" | "completed_with_errors" | "failed";
  objective: Record<string, unknown> | null;
  signals: unknown[];
  findings: unknown[];
  opportunities: unknown[];
  unknowns: string[];
  actions: unknown[];
  validationStatus: "supported" | "requires_review" | "rejected" | "legacy";
  validationIssues: Array<Record<string, unknown>>;
  createdAt: Date;
}

export interface InvestigationMarketSynthesisHistory {
  id: string;
  investigationId: string;
  provider: string;
  model: string | null;
  status: "running" | "completed" | "completed_with_errors" | "failed";
  executiveSummary: string | null;
  aggregates: Record<string, unknown> | null;
  risks: string[];
  unknowns: string[];
  actions: unknown[];
  validationStatus: "supported" | "requires_review" | "rejected" | "legacy";
  validationIssues: Array<Record<string, unknown>>;
  createdAt: Date;
  patterns: InvestigationMarketPattern[];
  opportunities: InvestigationMarketOpportunity[];
}

export interface InvestigationMarketPattern {
  id: string;
  synthesisId: string;
  title: string;
  summary: string;
  patternType: string;
  confidence: number | null;
  affectedBusinessIds: string[];
  evidenceIds: string[];
  claimIds: string[];
  claimType: string;
  status: string;
  unknowns: string[];
}

export interface InvestigationMarketOpportunity {
  id: string;
  synthesisId: string;
  title: string;
  statement: string;
  confidence: number | null;
  affectedBusinessIds: string[];
  evidenceIds: string[];
  riskSummary: string;
  status: "hypothesis" | "needs_validation" | "supported" | "rejected";
}

export interface InvestigationSynthesisHistory {
  id: string;
  investigationId: string;
  provider: string;
  model: string | null;
  status: InvestigationSynthesisStatus;
  executiveSummary: string | null;
  aggregates: Record<string, unknown> | null;
  findings: unknown[];
  opportunities: unknown[];
  risks: string[];
  unknowns: string[];
  actions: unknown[];
  validationStatus: InvestigationSynthesisValidationStatus;
  validationIssues: Array<Record<string, unknown>>;
  createdAt: Date;
}

export interface InvestigationRunSummary {
  id: string;
  role: InvestigationSearchRunRole;
  attachedAt: Date;
  query: string;
  country: string;
  city: string | null;
  depth: string;
  status: string;
  discoveredCount: number;
  evidenceItemsGenerated: number;
  durationMs: number | null;
  providers: string[] | null;
  completedAt: Date | null;
}

export interface InvestigationBusinessSummary {
  businessId: string;
  leadId?: string | null;
  role: InvestigationBusinessRole;
  includedReason: string | null;
  name: string;
  category: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  websiteStatus?: string | null;
  aiStatus?: "analyzed" | "not_analyzed";
  opportunityIndicator?: string | null;
  verificationStatus: string;
  rating: string | null;
  reviewCount: number | null;
}

export interface InvestigationEvidenceItem {
  id: string;
  businessId: string;
  runId: string | null;
  category: string;
  statement: string;
  value: string | null;
  sourceType: string;
  sourceUrl: string | null;
  confidence: string;
  observedAt: Date;
}

export interface InvestigationSourceConflict {
  id: string;
  businessId: string;
  category: string;
  fieldKey: string;
  status: string;
  items: Array<{ statement: string; value?: string; sourceType: string; sourceUrl?: string; confidence: string; observedAt: string }>;
  observedAt: Date;
}

export interface InvestigationAiConflict {
  businessId: string;
  analysisId: string;
  type: string;
  claim: string;
  reason: string;
  validationStatus: string;
}

export interface InvestigationMetrics {
  businesses: number;
  searchRuns: number;
  sources: number;
  evidence: number;
  supportedClaims: number;
  findings: number;
  opportunities: number;
  unknowns: number;
  contradictions: number;
}

export interface CreateInvestigationResult {
  investigationId: string;
}

export interface InvestigationListParams {
  page?: number;
  pageSize?: number;
  status?: InvestigationStatus;
  search?: string;
}