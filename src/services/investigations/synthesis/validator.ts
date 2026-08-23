import type { InvestigationSynthesisResult, SynthesisValidationIssue, SynthesisValidationResult } from "./types";

const FINDING_TYPES = new Set(["market_pattern", "business_pattern", "operational_signal", "digital_signal", "opportunity_signal", "risk"]);
const ACTION_TYPES = new Set(["verify", "interview", "research", "compare", "collect_data", "manual_review"]);
const PRIORITIES = new Set(["low", "medium", "high"]);

function isString(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function stringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every(isString); }
function numberInRange(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100; }

export function parseInvestigationSynthesisJson(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned); } catch { throw new Error("Synthesis response was not valid JSON."); }
}

export function validateInvestigationSynthesis(value: unknown, context: { businessIds: Set<string>; evidenceIds: Set<string>; claimIds: Set<string>; allowedNumbers?: Set<number> }): SynthesisValidationResult {
  const issues: SynthesisValidationIssue[] = [];
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  if (!record) throw new Error("Synthesis output must be a JSON object.");
  if (!isString(record.executiveSummary)) issues.push({ type: "invalid_field", path: "executiveSummary", message: "Executive summary is required." });
  const findingsInput = Array.isArray(record.findings) ? record.findings : [];
  const opportunitiesInput = Array.isArray(record.opportunities) ? record.opportunities : [];
  const actionsInput = Array.isArray(record.recommendedActions) ? record.recommendedActions : [];
  const allowedNumbers = context.allowedNumbers ?? new Set<number>();
  const checkNarrativeNumbers = (path: string, values: string[]) => {
    for (const value of values) {
      for (const token of value.match(/\b\d+(?:\.\d+)?\b/g) ?? []) {
        const numeric = Number(token);
        if (!allowedNumbers.has(numeric)) issues.push({ type: "unsupported_count", path, message: "Narrative contains a number that was not present in deterministic aggregates.", value: numeric });
      }
    }
  };
  const findings: InvestigationSynthesisResult["findings"] = [];
  for (let index = 0; index < findingsInput.length; index += 1) {
    const raw = findingsInput[index];
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const path = `findings[${index}]`;
    const businessIds = stringArray(item.businessIds) ? item.businessIds : [];
    const evidenceIds = stringArray(item.evidenceIds) ? item.evidenceIds : [];
    const claimIds = stringArray(item.claimIds) ? item.claimIds : [];
    if (!isString(item.title) || !isString(item.summary)) issues.push({ type: "invalid_finding", path, message: "Finding title and summary are required." });
    if (typeof item.findingType !== "string" || !FINDING_TYPES.has(item.findingType)) issues.push({ type: "invalid_finding_type", path: `${path}.findingType`, message: "Finding type is not supported.", value: item.findingType });
    if (!numberInRange(item.confidence)) issues.push({ type: "invalid_confidence", path: `${path}.confidence`, message: "Confidence must be an integer from 0 to 100." });
    if (businessIds.length === 0 || evidenceIds.length === 0) issues.push({ type: "missing_evidence_reference", path, message: "Findings require at least one business ID and evidence ID." });
    for (const id of businessIds) if (!context.businessIds.has(id)) issues.push({ type: "invalid_business_reference", path, message: "Business is outside the investigation.", value: id });
    for (const id of evidenceIds) if (!context.evidenceIds.has(id)) issues.push({ type: "invalid_evidence_reference", path, message: "Evidence ID was not supplied.", value: id });
    for (const id of claimIds) if (!context.claimIds.has(id)) issues.push({ type: "invalid_claim_reference", path, message: "Claim ID was not supplied.", value: id });
    if (isString(item.title) && isString(item.summary) && typeof item.findingType === "string" && FINDING_TYPES.has(item.findingType) && numberInRange(item.confidence)) findings.push({ title: item.title, summary: item.summary, findingType: item.findingType as InvestigationSynthesisResult["findings"][number]["findingType"], confidence: item.confidence, businessIds, evidenceIds, claimIds, unknowns: stringArray(item.unknowns) ? item.unknowns : [] });
    checkNarrativeNumbers(path, [isString(item.title) ? item.title : "", isString(item.summary) ? item.summary : ""]);
  }
  const opportunities: InvestigationSynthesisResult["opportunities"] = [];
  for (let index = 0; index < opportunitiesInput.length; index += 1) {
    const raw = opportunitiesInput[index];
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const path = `opportunities[${index}]`;
    const businessIds = stringArray(item.businessIds) ? item.businessIds : [];
    const evidenceIds = stringArray(item.evidenceIds) ? item.evidenceIds : [];
    if (!isString(item.title) || !isString(item.statement) || !isString(item.riskSummary)) issues.push({ type: "invalid_opportunity", path, message: "Opportunity title, statement, and risk summary are required." });
    if (!numberInRange(item.confidence)) issues.push({ type: "invalid_confidence", path: `${path}.confidence`, message: "Confidence must be an integer from 0 to 100." });
    if (item.status !== "hypothesis" && item.status !== "needs_validation") issues.push({ type: "unsafe_opportunity_status", path: `${path}.status`, message: "Opportunities may only be hypotheses or require validation." });
    if (businessIds.length === 0 || evidenceIds.length === 0) issues.push({ type: "missing_evidence_reference", path, message: "Opportunities require at least one business ID and evidence ID." });
    for (const id of businessIds) if (!context.businessIds.has(id)) issues.push({ type: "invalid_business_reference", path, message: "Business is outside the investigation.", value: id });
    for (const id of evidenceIds) if (!context.evidenceIds.has(id)) issues.push({ type: "invalid_evidence_reference", path, message: "Evidence ID was not supplied.", value: id });
    if (isString(item.title) && isString(item.statement) && isString(item.riskSummary) && numberInRange(item.confidence) && (item.status === "hypothesis" || item.status === "needs_validation")) opportunities.push({ title: item.title, statement: item.statement, confidence: item.confidence, businessIds, evidenceIds, riskSummary: item.riskSummary, status: item.status });
    checkNarrativeNumbers(path, [isString(item.title) ? item.title : "", isString(item.statement) ? item.statement : "", isString(item.riskSummary) ? item.riskSummary : ""]);
  }
  const recommendedActions = actionsInput.flatMap((raw, index) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    if (!isString(item.title) || !isString(item.description) || typeof item.priority !== "string" || !PRIORITIES.has(item.priority) || typeof item.actionType !== "string" || !ACTION_TYPES.has(item.actionType)) {
      issues.push({ type: "invalid_action", path: `recommendedActions[${index}]`, message: "Action has invalid fields." });
      return [];
    }
    return [{ title: item.title, description: item.description, priority: item.priority as "low" | "medium" | "high", actionType: item.actionType as InvestigationSynthesisResult["recommendedActions"][number]["actionType"] }];
  });
  const result: InvestigationSynthesisResult = { executiveSummary: isString(record.executiveSummary) ? record.executiveSummary : "", findings, opportunities, risks: stringArray(record.risks) ? record.risks : [], unknowns: stringArray(record.unknowns) ? record.unknowns : [], recommendedActions };
  const status = issues.some((issue) => ["invalid_business_reference", "invalid_evidence_reference", "invalid_claim_reference", "unsupported_count"].includes(issue.type)) ? "rejected" : issues.length ? "requires_review" : "supported";
  return { status, issues, result };
}