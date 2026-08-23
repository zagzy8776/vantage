import type { MarketSynthesisResult, MarketValidationIssue, MarketValidationResult } from "./types";

const TYPES = new Set(["market_pattern", "digital_pattern", "operational_signal", "service_signal", "risk_pattern", "evidence_gap"]);
const CLAIM_TYPES = new Set(["fact", "derived", "inference", "unknown"]);
const ACTION_TYPES = new Set(["verify", "interview", "research", "compare", "collect_data", "manual_review"]);
const PRIORITIES = new Set(["low", "medium", "high"]);
const OPPORTUNITY_STATUSES = new Set(["hypothesis", "needs_validation"]);
const GENERALIZATION = /\b(?:all|every|most|the entire|the whole|toronto\s+(?:salons?|market)|industry-wide|market-wide)\b/i;
const UNSUPPORTED_ABSENCE = /\b(?:none|no|all lack|lack(?:s|ing)?|do not have|does not have|without)\b[^.]{0,80}\b(?:social|pricing|page.?speed|booking|ecommerce|e-commerce|website|revenue|appointment)/i;

const isString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const confidence = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;

export function parseMarketSynthesisJson(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned); } catch { throw new Error("Market synthesis response was not valid JSON."); }
}

export function validateMarketSynthesis(value: unknown, context: { businessIds: Set<string>; evidenceIds: Set<string>; claimIds: Set<string>; allowedNumbers: Set<number> }): MarketValidationResult {
  const issues: MarketValidationIssue[] = [];
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  if (!record) throw new Error("Market synthesis output must be a JSON object.");
  const patternsInput = Array.isArray(record.marketPatterns) ? record.marketPatterns : [];
  const opportunitiesInput = Array.isArray(record.opportunities) ? record.opportunities : [];
  const patterns: MarketSynthesisResult["marketPatterns"] = [];
  const checkText = (path: string, values: string[]) => { for (const value of values) { if (GENERALIZATION.test(value)) issues.push({ type: "unsupported_market_generalization", path, message: "Market pattern language must remain scoped to the reviewed sample." }); if (UNSUPPORTED_ABSENCE.test(value)) issues.push({ type: "unsupported_absence", path, message: "Evidence presence does not establish absence for other businesses." }); for (const token of value.match(/\b\d+(?:\.\d+)?\b/g) ?? []) if (!context.allowedNumbers.has(Number(token))) issues.push({ type: "unsupported_count", path, message: "Narrative contains a count not present in deterministic aggregates.", value: Number(token) }); } };
  for (let index = 0; index < patternsInput.length; index += 1) {
    const raw = patternsInput[index]; const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; const path = `marketPatterns[${index}]`;
    const businessIds = strings(item.businessIds) ? item.businessIds : []; const evidenceIds = strings(item.evidenceIds) ? item.evidenceIds : []; const claimIds = strings(item.claimIds) ? item.claimIds : [];
    if (!isString(item.title) || !isString(item.summary) || typeof item.type !== "string" || !TYPES.has(item.type) || typeof item.claimType !== "string" || !CLAIM_TYPES.has(item.claimType) || !confidence(item.confidence)) issues.push({ type: "invalid_market_pattern", path, message: "Market pattern fields are invalid." });
    if (item.type !== "evidence_gap" && (!businessIds.length || !evidenceIds.length)) issues.push({ type: "missing_evidence_reference", path, message: "Market patterns require business and evidence references." });
    if (item.type === "evidence_gap" && item.status !== "requires_review") issues.push({ type: "unsafe_evidence_gap", path, message: "Evidence gaps must remain requires_review." });
    for (const id of businessIds) if (!context.businessIds.has(id)) issues.push({ type: "invalid_business_reference", path, message: "Business is outside the investigation.", value: id });
    for (const id of evidenceIds) if (!context.evidenceIds.has(id)) issues.push({ type: "invalid_evidence_reference", path, message: "Evidence is outside the investigation.", value: id });
    for (const id of claimIds) if (!context.claimIds.has(id)) issues.push({ type: "invalid_claim_reference", path, message: "Claim is outside the investigation.", value: id });
    if (isString(item.title) && isString(item.summary) && typeof item.type === "string" && TYPES.has(item.type) && typeof item.claimType === "string" && CLAIM_TYPES.has(item.claimType) && confidence(item.confidence)) patterns.push({ title: item.title, summary: item.summary, type: item.type as MarketSynthesisResult["marketPatterns"][number]["type"], confidence: item.confidence, businessIds, evidenceIds, claimType: item.claimType as MarketSynthesisResult["marketPatterns"][number]["claimType"], claimIds, status: item.status === "supported" ? "supported" : "requires_review", unknowns: strings(item.unknowns) ? item.unknowns : [] });
    checkText(path, [isString(item.title) ? item.title : "", isString(item.summary) ? item.summary : ""]);
  }
  const opportunities: MarketSynthesisResult["opportunities"] = [];
  for (let index = 0; index < opportunitiesInput.length; index += 1) {
    const raw = opportunitiesInput[index]; const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; const path = `opportunities[${index}]`; const businessIds = strings(item.businessIds) ? item.businessIds : []; const evidenceIds = strings(item.evidenceIds) ? item.evidenceIds : [];
    if (!isString(item.title) || !isString(item.statement) || !isString(item.riskSummary) || !confidence(item.confidence) || typeof item.status !== "string" || !OPPORTUNITY_STATUSES.has(item.status)) issues.push({ type: "invalid_market_opportunity", path, message: "Market opportunity must be a hypothesis or require validation." });
    if (!businessIds.length || !evidenceIds.length) issues.push({ type: "missing_evidence_reference", path, message: "Market opportunities require business and evidence references." });
    for (const id of businessIds) if (!context.businessIds.has(id)) issues.push({ type: "invalid_business_reference", path, message: "Business is outside the investigation.", value: id });
    for (const id of evidenceIds) if (!context.evidenceIds.has(id)) issues.push({ type: "invalid_evidence_reference", path, message: "Evidence is outside the investigation.", value: id });
    if (isString(item.title) && isString(item.statement) && isString(item.riskSummary) && confidence(item.confidence) && typeof item.status === "string" && OPPORTUNITY_STATUSES.has(item.status)) opportunities.push({ title: item.title, statement: item.statement, confidence: item.confidence, businessIds, evidenceIds, riskSummary: item.riskSummary, status: item.status as "hypothesis" | "needs_validation" });
    checkText(path, [isString(item.title) ? item.title : "", isString(item.statement) ? item.statement : "", isString(item.riskSummary) ? item.riskSummary : ""]);
  }
  const actions = (Array.isArray(record.recommendedActions) ? record.recommendedActions : []).flatMap((raw, index) => { const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; if (!isString(item.title) || !isString(item.description) || typeof item.priority !== "string" || !PRIORITIES.has(item.priority) || typeof item.actionType !== "string" || !ACTION_TYPES.has(item.actionType)) { issues.push({ type: "invalid_action", path: `recommendedActions[${index}]`, message: "Recommended action is invalid." }); return []; } return [{ title: item.title, description: item.description, priority: item.priority as "low" | "medium" | "high", actionType: item.actionType as MarketSynthesisResult["recommendedActions"][number]["actionType"] }]; });
  const result: MarketSynthesisResult = { executiveSummary: isString(record.executiveSummary) ? record.executiveSummary : "", marketPatterns: patterns, opportunities, risks: strings(record.risks) ? record.risks : [], unknowns: strings(record.unknowns) ? record.unknowns : [], recommendedActions: actions };
  if (!result.executiveSummary) issues.push({ type: "invalid_field", path: "executiveSummary", message: "Executive summary is required." });
  checkText("executiveSummary", [result.executiveSummary]);
  checkText("risks", result.risks);
  checkText("unknowns", result.unknowns);
  checkText("recommendedActions", actions.flatMap((action) => [action.title, action.description]));
  const rejected = issues.some((issue) => ["invalid_business_reference", "invalid_evidence_reference", "invalid_claim_reference", "unsupported_count", "unsupported_market_generalization", "unsupported_absence"].includes(issue.type));
  return { status: rejected ? "rejected" : issues.length ? "requires_review" : "supported", issues, result };
}