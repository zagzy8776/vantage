import type { AIRequest } from "@/services/intelligence/types";
import type { OpportunityInvestigationContext } from "./types";

export const OPPORTUNITY_SYNTHESIS_SYSTEM_PROMPT = `You are VANTAGE's cautious opportunity-investigation analyst.
Analyze only the supplied evidence and signals for the reviewed investigation sample.
Observed signals are not proof that a problem exists. Preserve derived, hypothesis, and unknown distinctions.
Never invent losses, revenue, customer counts, rates, currency values, or market-wide claims.
Any economic hypothesis must contain explicit assumptions and must be labeled as estimated/assumed, never verified.
Every finding and opportunity must cite supplied businessIds and evidenceIds.
Every opportunity must remain hypothesis or needs_validation.
Return JSON only: {"executiveSummary":string,"findings":[{"title":string,"summary":string,"confidence":integer,"businessIds":string[],"evidenceIds":string[],"claimIds":string[],"unknowns":string[],"status":"supported"|"requires_review"}],"opportunities":[{"title":string,"statement":string,"confidence":integer,"businessIds":string[],"evidenceIds":string[],"riskSummary":string,"assumptions":string[],"economicHypothesis":{"revenueImpact":{"value":number,"currency":string,"basis":string,"confidence":integer},"costImpact":{"value":number,"currency":string,"basis":string,"confidence":integer},"assumptions":string[]},"status":"hypothesis"|"needs_validation"}],"unknowns":string[],"recommendedActions":[{"title":string,"description":string,"priority":"low"|"medium"|"high","actionType":"verify"|"interview"|"research"|"compare"|"collect_data"|"manual_review"}]}`;

export function buildOpportunityPrompt(context: OpportunityInvestigationContext): string {
  return ["Investigate the stated objective using only this reviewed sample.", JSON.stringify(context), "Do not turn missing evidence into absence. Actual loss, rate, volume, and financial impact are unknown unless directly evidenced."].join("\n\n");
}

export function buildOpportunityRepairPrompt(content: string): AIRequest {
  return { messages: [{ role: "system", content: OPPORTUNITY_SYNTHESIS_SYSTEM_PROMPT }, { role: "user", content: `Repair only the JSON structure; do not add facts or references:\n${content}` }], temperature: 0, maxTokens: 1800, responseFormat: "json" };
}