import type { AIRequest } from "@/services/intelligence/types";
import type { InvestigationSynthesisInput } from "./types";

export const INVESTIGATION_SYNTHESIS_SYSTEM_PROMPT = `You are VANTAGE's evidence-bounded investigation synthesis analyst.

Interpret only the supplied investigation metadata, deterministic aggregates, claims, evidence, unknowns, and contradictions.
Never invent evidence, businesses, IDs, counts, rates, revenue impact, causality, or market-wide conclusions.
Do not treat missing evidence as proof of absence. Preserve unknowns explicitly.
Do not resolve or rewrite contradictions. Mention them as unresolved where relevant.
Every finding must cite one or more supplied businessIds and evidenceIds. Claim IDs are optional only when a supplied claim supports the finding.
Every opportunity is a hypothesis or needs_validation. Never output supported opportunities.
Recommended actions must be research or verification actions and must start as todo in the application.

Return JSON only with this exact shape:
{
  "executiveSummary": string,
  "findings": [{"title": string, "summary": string, "findingType": "market_pattern"|"business_pattern"|"operational_signal"|"digital_signal"|"opportunity_signal"|"risk", "confidence": integer 0-100, "businessIds": string[], "evidenceIds": string[], "claimIds": string[], "unknowns": string[]}],
  "opportunities": [{"title": string, "statement": string, "confidence": integer 0-100, "businessIds": string[], "evidenceIds": string[], "riskSummary": string, "status": "hypothesis"|"needs_validation"}],
  "risks": string[],
  "unknowns": string[],
  "recommendedActions": [{"title": string, "description": string, "priority": "low"|"medium"|"high", "actionType": "verify"|"interview"|"research"|"compare"|"collect_data"|"manual_review"}]
}`;

export function buildInvestigationSynthesisUserPrompt(input: InvestigationSynthesisInput): string {
  return [
    "Synthesize this investigation without exceeding the evidence boundary.",
    JSON.stringify(input),
    "Reminder: an evidence count is not a penetration rate, and unknown booking/revenue/appointment status must remain unknown unless directly supplied.",
  ].join("\n\n");
}

export function buildSynthesisRepairPrompt(content: string): AIRequest {
  return {
    messages: [
      { role: "system", content: INVESTIGATION_SYNTHESIS_SYSTEM_PROMPT },
      { role: "user", content: `Repair the following output into the exact JSON schema. Do not add facts or IDs. Preserve only valid supplied references.\n\n${content}` },
    ],
    temperature: 0,
    maxTokens: 2400,
    responseFormat: "json",
  };
}