import type { AIOpportunityLevel } from "@/lib/types";
import type { EvidenceCategory, EvidenceConfidence, EvidenceSourceType } from "@/services/evidence/types";

export type EvidenceType = "fact" | "derived" | "inference";
export type AIValidationStatus = "supported" | "requires_review" | "rejected" | "legacy";

export type ValidationIssueType =
  | "missing_evidence_reference"
  | "invalid_evidence_reference"
  | "cross_business_evidence"
  | "unsupported_fact"
  | "unsupported_absence"
  | "contradiction"
  | "invalid_claim_type";

export interface ValidationIssue {
  type: ValidationIssueType;
  claim: string;
  reason: string;
  evidenceIds?: string[];
}

export interface EvidenceItem {
  statement: string;
  type: EvidenceType;
  source: string;
  evidenceIds: string[];
  confidence?: number;
}

export interface LeadIntelligence {
  businessSummary: string;
  opportunityLevel: AIOpportunityLevel;
  opportunityScore: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  risks: string[];
  recommendedServices: string[];
  evidence: EvidenceItem[];
  unknowns: string[];
  reasoning: string;
  confidence: number;
}

export interface LeadIntelligenceInput {
  business: {
    name: string;
    category?: string;
    location?: string;
    rating?: number;
    reviewCount?: number;
    website?: string;
    phone?: string;
    source?: string;
  };
  website?: {
    url: string;
    status: string;
    performance?: number;
    accessibility?: number;
    bestPractices?: number;
    seo?: number;
    mobilePerformance?: number;
    desktopPerformance?: number;
    analyzedAt?: string;
  };
  evidence?: Array<{
    id: string;
    category: EvidenceCategory;
    statement: string;
    value?: string;
    sourceType: EvidenceSourceType;
    sourceUrl?: string;
    confidence: EvidenceConfidence;
    observedAt: string;
  }>;
}

export interface AIAnalysisUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface StoredLeadIntelligence extends LeadIntelligence {
  id: string;
  leadId: string;
  businessId: string;
  provider: string;
  model?: string | null;
  fallbackUsed: boolean;
  attempts: number;
  validationStatus: AIValidationStatus;
  validationIssues: ValidationIssue[];
  usage?: AIAnalysisUsage;
  createdAt: string;
}

export interface ValidationEvidence {
  id: string;
  businessId: string;
  statement: string;
  value?: string | null;
  sourceType: string;
  sourceUrl?: string | null;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json";
}

export interface AIResult {
  provider: string;
  model?: string;
  modelSource?: "environment" | "provider-default";
  modelRole?: "primary" | "fallback" | "preview";
  content: string;
  requestId?: string;
  usage?: AIAnalysisUsage;
}

export class IntelligenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntelligenceValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new IntelligenceValidationError(`${field} must be a non-empty string.`);
  return value.trim();
}

function stringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new IntelligenceValidationError(`${field} must be an array of non-empty strings.`);
  }
  return value.map((item) => (item as string).trim());
}

export function validateLeadIntelligence(value: unknown): LeadIntelligence {
  if (!isRecord(value)) throw new IntelligenceValidationError("AI response must be a JSON object.");

  const opportunityLevels: AIOpportunityLevel[] = ["very-low", "low", "medium", "high", "very-high"];
  const opportunityLevel = value.opportunityLevel;
  if (!opportunityLevels.includes(opportunityLevel as AIOpportunityLevel)) throw new IntelligenceValidationError("opportunityLevel is invalid.");
  if (typeof value.opportunityScore !== "number" || !Number.isInteger(value.opportunityScore) || value.opportunityScore < 0 || value.opportunityScore > 100) {
    throw new IntelligenceValidationError("opportunityScore must be an integer from 0 to 100.");
  }
  if (typeof value.confidence !== "number" || !Number.isInteger(value.confidence) || value.confidence < 0 || value.confidence > 100) {
    throw new IntelligenceValidationError("confidence must be an integer from 0 to 100.");
  }
  if (!Array.isArray(value.evidence)) throw new IntelligenceValidationError("evidence must be an array.");

  const evidence = value.evidence.map((item, index) => {
    if (!isRecord(item)) throw new IntelligenceValidationError(`evidence[${index}] must be an object.`);
    const type = item.type;
    if (type !== "fact" && type !== "derived" && type !== "inference") throw new IntelligenceValidationError(`evidence[${index}].type is invalid.`);
    const result: EvidenceItem = {
      statement: requiredString(item.statement, `evidence[${index}].statement`),
      type,
      source: requiredString(item.source, `evidence[${index}].source`),
      evidenceIds: stringArray(item.evidenceIds, `evidence[${index}].evidenceIds`),
    };
    if (item.confidence !== undefined) {
      if (typeof item.confidence !== "number" || !Number.isInteger(item.confidence) || item.confidence < 0 || item.confidence > 100) {
        throw new IntelligenceValidationError(`evidence[${index}].confidence must be an integer from 0 to 100.`);
      }
      result.confidence = item.confidence;
    }
    return result;
  });

  if (value.unknowns !== undefined && (!Array.isArray(value.unknowns) || value.unknowns.some((item) => typeof item !== "string" || !item.trim()))) {
    throw new IntelligenceValidationError("unknowns must be an array of non-empty strings.");
  }

  return {
    businessSummary: requiredString(value.businessSummary, "businessSummary"),
    opportunityLevel: opportunityLevel as AIOpportunityLevel,
    opportunityScore: value.opportunityScore,
    strengths: stringArray(value.strengths, "strengths"),
    weaknesses: stringArray(value.weaknesses, "weaknesses"),
    opportunities: stringArray(value.opportunities, "opportunities"),
    risks: stringArray(value.risks, "risks"),
    recommendedServices: stringArray(value.recommendedServices, "recommendedServices"),
    evidence,
    unknowns: stringArray(value.unknowns ?? [], "unknowns"),
    reasoning: requiredString(value.reasoning, "reasoning"),
    confidence: value.confidence,
  };
}

export function parseLeadIntelligenceJson(content: string): LeadIntelligence {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return validateLeadIntelligence(JSON.parse(cleaned));
  } catch (error) {
    if (error instanceof IntelligenceValidationError) throw error;
    throw new IntelligenceValidationError("AI response was not valid JSON.");
  }
}