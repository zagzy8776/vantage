import type { OpportunitySynthesisResult, OpportunityValidationIssue, OpportunityValidationResult } from "./types";

const ACTIONS = new Set(["verify", "interview", "research", "compare", "collect_data", "manual_review"]);
const PRIORITIES = new Set(["low", "medium", "high"]);
const ABSENCE = /\b(?:none|no(?![-\w\u2010-\u2015])|all lack|lacks?|do not have|does not have)\b(?![^.]{0,30}\b(?:direct\s+)?evidence\b)[^.]{0,80}\b(?:booking|appointment|money|revenue|loss|customers?|businesses?)|\b(?:loses?|losing)\b[^.]{0,80}\b(?:money|revenue|income|\d)/i;

const str = (v: unknown): v is string => typeof v === "string" && Boolean(v.trim());
const arr = (v: unknown): v is string[] => Array.isArray(v) && v.every(str);
const pct = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100;

export function validateOpportunitySynthesis(value: unknown, context: { businessIds: Set<string>; evidenceIds: Set<string>; claimIds: Set<string>; allowedNumbers: Set<number> }): OpportunityValidationResult {
  const issues: OpportunityValidationIssue[] = [];
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  if (!record) throw new Error("Opportunity synthesis output must be an object.");
  const checkText = (path: string, values: string[]) => values.forEach((text) => { if (ABSENCE.test(text)) issues.push({ type: "unsupported_absence_or_loss", path, message: "Absence, loss, and financial claims require direct evidence." }); for (const token of text.match(/\b\d+(?:\.\d+)?\b/g) ?? []) if (!context.allowedNumbers.has(Number(token))) issues.push({ type: "unsupported_count", path, message: "Number is not present in deterministic inputs.", value: Number(token) }); });
  const findings: OpportunitySynthesisResult["findings"] = [];
  const findingsInput = Array.isArray(record.findings) ? record.findings : [];
  for (let index = 0; index < findingsInput.length; index += 1) {
    const raw = findingsInput[index];
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; const path = `findings[${index}]`; const businessIds = arr(item.businessIds) ? item.businessIds : []; const evidenceIds = arr(item.evidenceIds) ? item.evidenceIds : []; const claimIds = arr(item.claimIds) ? item.claimIds : [];
    if (!str(item.title) || !str(item.summary) || !pct(item.confidence) || !businessIds.length || !evidenceIds.length) issues.push({ type: "invalid_finding", path, message: "Findings require title, summary, confidence, businesses, and evidence." });
    for (const id of businessIds) if (!context.businessIds.has(id)) issues.push({ type: "invalid_business_reference", path, message: "Business is outside the investigation.", value: id });
    for (const id of evidenceIds) if (!context.evidenceIds.has(id)) issues.push({ type: "invalid_evidence_reference", path, message: "Evidence is outside the investigation.", value: id });
    for (const id of claimIds) if (!context.claimIds.has(id)) issues.push({ type: "invalid_claim_reference", path, message: "Claim is outside the investigation.", value: id });
    if (str(item.title) && str(item.summary) && pct(item.confidence)) findings.push({ title: item.title, summary: item.summary, confidence: item.confidence, businessIds, evidenceIds, claimIds, unknowns: arr(item.unknowns) ? item.unknowns : [], status: item.status === "supported" ? "supported" : "requires_review" });
    checkText(path, [str(item.title) ? item.title : "", str(item.summary) ? item.summary : ""]);
  }
  const opportunities: OpportunitySynthesisResult["opportunities"] = [];
  const opportunitiesInput = Array.isArray(record.opportunities) ? record.opportunities : [];
  for (let index = 0; index < opportunitiesInput.length; index += 1) {
    const raw = opportunitiesInput[index];
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; const path = `opportunities[${index}]`; const businessIds = arr(item.businessIds) ? item.businessIds : []; const evidenceIds = arr(item.evidenceIds) ? item.evidenceIds : [];
    if (!str(item.title) || !str(item.statement) || !str(item.riskSummary) || !pct(item.confidence) || (item.status !== "hypothesis" && item.status !== "needs_validation") || !businessIds.length || !evidenceIds.length) issues.push({ type: "invalid_opportunity", path, message: "Opportunities require evidence and must remain hypotheses or needs_validation." });
    for (const id of businessIds) if (!context.businessIds.has(id)) issues.push({ type: "invalid_business_reference", path, message: "Business is outside the investigation.", value: id });
    for (const id of evidenceIds) if (!context.evidenceIds.has(id)) issues.push({ type: "invalid_evidence_reference", path, message: "Evidence is outside the investigation.", value: id });
    const economic = item.economicHypothesis && typeof item.economicHypothesis === "object" ? item.economicHypothesis as Record<string, unknown> : undefined;
    if (economic) { if (!arr(economic.assumptions) || !economic.assumptions.length) issues.push({ type: "economic_assumptions_required", path, message: "Economic hypotheses require explicit assumptions." }); checkText(`${path}.economicHypothesis`, arr(economic.assumptions) ? economic.assumptions : []); }
    if (str(item.title) && str(item.statement) && str(item.riskSummary) && pct(item.confidence) && (item.status === "hypothesis" || item.status === "needs_validation")) opportunities.push({ title: item.title, statement: item.statement, confidence: item.confidence, businessIds, evidenceIds, riskSummary: item.riskSummary, assumptions: economic && arr(economic.assumptions) ? economic.assumptions : [], economicHypothesis: economic as OpportunitySynthesisResult["opportunities"][number]["economicHypothesis"], status: item.status });
    checkText(path, [str(item.title) ? item.title : "", str(item.statement) ? item.statement : "", str(item.riskSummary) ? item.riskSummary : ""]);
  }
  const actions = (Array.isArray(record.recommendedActions) ? record.recommendedActions : []).flatMap((raw, index) => { const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; if (!str(item.title) || !str(item.description) || typeof item.priority !== "string" || !PRIORITIES.has(item.priority) || typeof item.actionType !== "string" || !ACTIONS.has(item.actionType)) { issues.push({ type: "invalid_action", path: `recommendedActions[${index}]`, message: "Recommended action is invalid." }); return []; } return [{ title: item.title, description: item.description, priority: item.priority as "low" | "medium" | "high", actionType: item.actionType as OpportunitySynthesisResult["recommendedActions"][number]["actionType"] }]; });
  const result: OpportunitySynthesisResult = { executiveSummary: str(record.executiveSummary) ? record.executiveSummary : "", findings, opportunities, unknowns: arr(record.unknowns) ? record.unknowns : [], recommendedActions: actions };
  checkText("executiveSummary", [result.executiveSummary]); checkText("unknowns", result.unknowns); checkText("recommendedActions", actions.flatMap((a) => [a.title, a.description]));
  const rejected = issues.some((issue) => ["invalid_business_reference", "invalid_evidence_reference", "invalid_claim_reference", "unsupported_count", "unsupported_absence_or_loss"].includes(issue.type));
  return { status: rejected ? "rejected" : issues.length ? "requires_review" : "supported", issues, result };
}