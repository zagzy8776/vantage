import type { AIRequest } from "@/services/intelligence/types";
import type { MarketSynthesisInput } from "./types";

export const MARKET_SYNTHESIS_SYSTEM_PROMPT = `You are VANTAGE's cautious market-intelligence analyst.

Analyze only the supplied deterministic cross-business aggregates, candidate patterns, bounded evidence, claims, unknowns, and contradictions.
The businesses are a reviewed investigation sample, not a census of the market. Always use wording such as "among the businesses reviewed" or "in this investigation sample".
Never invent evidence, business IDs, evidence IDs, counts, rates, revenue impact, causality, or market-wide facts.
Do not turn evidence absence into a negative fact. Preserve evidence gaps and unknowns explicitly.
Every market pattern must cite real supplied businessIds and evidenceIds unless it is an evidence_gap pattern, which must remain requires_review.
Every opportunity must be a hypothesis or needs_validation. Never output supported opportunities.
Recommended actions must be research or verification actions and start as todo.

Return JSON only with:
{"executiveSummary":string,"marketPatterns":[{"title":string,"summary":string,"type":"market_pattern"|"digital_pattern"|"operational_signal"|"service_signal"|"risk_pattern"|"evidence_gap","confidence":integer,"businessIds":string[],"evidenceIds":string[],"claimType":"fact"|"derived"|"inference"|"unknown","claimIds":string[],"status":"supported"|"requires_review","unknowns":string[]}],"opportunities":[{"title":string,"statement":string,"confidence":integer,"businessIds":string[],"evidenceIds":string[],"riskSummary":string,"status":"hypothesis"|"needs_validation"}],"risks":string[],"unknowns":string[],"recommendedActions":[{"title":string,"description":string,"priority":"low"|"medium"|"high","actionType":"verify"|"interview"|"research"|"compare"|"collect_data"|"manual_review"}]}`;

export function buildMarketSynthesisPrompt(input: MarketSynthesisInput): string {
  return ["Analyze the following reviewed investigation sample. Do not generalize beyond it.", JSON.stringify(input), input.aggregates.sampleLanguage, "Use deterministic aggregate counts exactly as supplied. Evidence presence does not establish absence for other businesses."].join("\n\n");
}

export function buildMarketRepairPrompt(content: string): AIRequest {
  return { messages: [{ role: "system", content: MARKET_SYNTHESIS_SYSTEM_PROMPT }, { role: "user", content: `Repair this output to the required JSON shape without adding facts or IDs:\n${content}` }], temperature: 0, maxTokens: 1800, responseFormat: "json" };
}