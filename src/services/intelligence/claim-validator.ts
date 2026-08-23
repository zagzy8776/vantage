import type { LeadIntelligence, ValidationEvidence, ValidationIssue, AIValidationStatus } from "./types";

const ABSENCE_PATTERN = /\b(?:does not|doesn't|do not|don't|lacks?|no|never|cannot|can't)\s+(?:offer|have|provide|support|accept|include|show|use)|\bno\s+(?:online\s+)?(?:booking|e-commerce|website|ordering)\b/i;
const ABSENCE_OF_EVIDENCE_PATTERN = /\b(?:no\s+[^.]{0,40}\bevidence|not evidenced|not discoverable|not established|unknown|availability is unknown|was not found|wasn't found)\b/i;
const UNREACHABLE_PATTERN = /\b(?:website|site|page)\b[^.]{0,80}\b(?:unreachable|inaccessible|down|unavailable|cannot be accessed|can't be accessed)\b|\b(?:unreachable|inaccessible|down|unavailable)\b[^.]{0,80}\b(?:website|site|page)\b/i;

function normalizedTokens(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 3);
}

function directlySupports(claim: string, evidence: ValidationEvidence[]) {
  const claimTokens = normalizedTokens(claim);
  if (!claimTokens.length) return false;
  const sourceText = evidence.map((item) => `${item.statement} ${item.value ?? ""}`.toLowerCase()).join(" ");
  const matchingTokens = claimTokens.filter((token) => sourceText.includes(token));
  if (matchingTokens.length >= Math.min(2, claimTokens.length)) return true;
  return /(?:booking|appointment)/i.test(claim) && /(?:only|accepted|take).{0,30}(?:phone|call)/i.test(sourceText);
}

function issue(type: ValidationIssue["type"], claim: string, reason: string, evidenceIds?: string[]): ValidationIssue {
  return { type, claim, reason, ...(evidenceIds?.length ? { evidenceIds } : {}) };
}

export interface ClaimValidationResult {
  status: Exclude<AIValidationStatus, "legacy">;
  issues: ValidationIssue[];
}

export function validateIntelligenceClaims(intelligence: LeadIntelligence, evidence: ValidationEvidence[], businessId: string): ClaimValidationResult {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const issues: ValidationIssue[] = [];

  for (const claim of intelligence.evidence) {
    if (!claim.evidenceIds.length) {
      issues.push(issue("missing_evidence_reference", claim.statement, `${claim.type.toUpperCase()} claims must cite at least one evidence ID.`));
      continue;
    }
    const cited = claim.evidenceIds.map((id) => evidenceById.get(id));
    const invalidIds = claim.evidenceIds.filter((id, index) => !cited[index]);
    if (invalidIds.length) issues.push(issue("invalid_evidence_reference", claim.statement, "One or more cited evidence IDs were not supplied to the model.", invalidIds));
    const resolved = cited.filter((item): item is ValidationEvidence => Boolean(item));
    const crossBusiness = resolved.filter((item) => item.businessId !== businessId);
    if (crossBusiness.length) issues.push(issue("cross_business_evidence", claim.statement, "A claim cites evidence belonging to another business.", crossBusiness.map((item) => item.id)));
    const validCited = resolved.filter((item) => item.businessId === businessId);
    if (claim.type === "fact" && validCited.length && !directlySupports(claim.statement, validCited)) {
      issues.push(issue("unsupported_fact", claim.statement, "The cited source evidence does not directly support this FACT claim.", validCited.map((item) => item.id)));
    }
    if (ABSENCE_PATTERN.test(claim.statement) && !ABSENCE_OF_EVIDENCE_PATTERN.test(claim.statement)) {
      if (!validCited.length || !directlySupports(claim.statement, validCited)) {
        issues.push(issue("unsupported_absence", claim.statement, "Absolute absence claims require direct evidence; missing evidence is UNKNOWN, not proof of absence.", validCited.map((item) => item.id)));
      }
    }
    if (UNREACHABLE_PATTERN.test(claim.statement)) {
      const hasExplicitUnreachableEvidence = validCited.some((item) => /(?:timeout|network|http\s*(?:4|5)\d\d|unreachable|connection failed)/i.test(`${item.statement} ${item.value ?? ""}`) && !/NO_FCP/i.test(`${item.statement} ${item.value ?? ""}`));
      const hasSuccessfulPageSpeed = evidence.some((item) => item.sourceType === "pagespeed" && /completed successfully|analysis completed successfully/i.test(item.statement));
      if (!hasExplicitUnreachableEvidence || hasSuccessfulPageSpeed) issues.push(issue("contradiction", claim.statement, "The supplied evidence does not establish that the website is unreachable, and may contain successful PageSpeed evidence.", claim.evidenceIds));
    }
  }

  const narrative = [...intelligence.strengths, ...intelligence.weaknesses, ...intelligence.opportunities, ...intelligence.risks, ...intelligence.recommendedServices, intelligence.businessSummary, intelligence.reasoning];
  for (const claim of narrative) {
    if (ABSENCE_PATTERN.test(claim) && !ABSENCE_OF_EVIDENCE_PATTERN.test(claim)) {
      issues.push(issue("unsupported_absence", claim, "Absolute absence claims in narrative fields require direct cited evidence; missing evidence is UNKNOWN."));
    }
    if (UNREACHABLE_PATTERN.test(claim)) {
      issues.push(issue("contradiction", claim, "Narrative claims cannot state that a website is unreachable without explicit supporting evidence."));
    }
  }

  const status = issues.some((item) => ["invalid_evidence_reference", "cross_business_evidence", "invalid_claim_type"].includes(item.type))
    ? "rejected"
    : issues.length ? "requires_review" : "supported";
  return { status, issues };
}