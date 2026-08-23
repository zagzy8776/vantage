import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const runId = process.argv[2];
if (!runId) throw new Error("Usage: node scripts/get-deep-search3-report.mjs <runId>");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const sql = neon(process.env.DATABASE_URL);

const runs = await sql`
  SELECT id, query, country, city, depth, search_source, status, started_at,
         completed_at, duration_ms, discovered_count, enriched_count,
         verified_count, rejected_count, stages, provider_metrics, result, failures
  FROM search_runs
  WHERE id = ${runId}
  LIMIT 1
`;
if (!runs[0]) throw new Error(`Search run not found: ${runId}`);
const run = runs[0];

const analyses = await sql`
  SELECT aa.id, aa.business_id, aa.lead_id, aa.provider, aa.model, aa.status,
         aa.opportunity_score, aa.opportunity_level, aa.business_summary,
         aa.strengths, aa.weaknesses, aa.opportunities, aa.risks,
         aa.recommended_services, aa.evidence AS ai_evidence, aa.reasoning,
         aa.confidence, aa.fallback_used, aa.attempts, aa.prompt_tokens,
         aa.completion_tokens, aa.total_tokens, aa.error_code, aa.created_at,
         b.name, b.website, b.category, b.address, b.city, b.country,
         b.source, b.verification_status, b.phone, b.rating, b.review_count
  FROM ai_analyses aa
  JOIN businesses b ON b.id = aa.business_id
  WHERE aa.run_id = ${runId}
  ORDER BY aa.created_at ASC
`;

const evidence = await sql`
  SELECT id, business_id, category, statement, value, source_type, source_url,
         confidence, observed_at, metadata
  FROM evidence_items
  WHERE run_id = ${runId}
  ORDER BY business_id, observed_at ASC
`;

const evidenceByBusiness = new Map();
for (const item of evidence) {
  const items = evidenceByBusiness.get(item.business_id) ?? [];
  items.push(item);
  evidenceByBusiness.set(item.business_id, items);
}

const businesses = analyses.map((analysis) => ({
  business: {
    id: analysis.business_id,
    leadId: analysis.lead_id,
    name: analysis.name,
    category: analysis.category,
    location: [analysis.address, analysis.city, analysis.country].filter(Boolean).join(", "),
    website: analysis.website,
    phone: analysis.phone,
    rating: analysis.rating,
    reviewCount: analysis.review_count,
    source: analysis.source,
    verificationStatus: analysis.verification_status,
  },
  ai: {
    provider: analysis.provider,
    model: analysis.model,
    status: analysis.status,
    fallbackUsed: Boolean(analysis.fallback_used),
    attempts: analysis.attempts,
    opportunityScore: analysis.opportunity_score,
    opportunityLevel: analysis.opportunity_level,
    summary: analysis.business_summary,
    strengths: analysis.strengths ?? [],
    weaknesses: analysis.weaknesses ?? [],
    potentialOpportunities: analysis.opportunities ?? [],
    risks: analysis.risks ?? [],
    recommendedServices: analysis.recommended_services ?? [],
    evidence: analysis.ai_evidence ?? [],
    reasoning: analysis.reasoning,
    confidence: analysis.confidence,
    createdAt: analysis.created_at,
  },
  persistedEvidence: evidenceByBusiness.get(analysis.business_id) ?? [],
}));

console.log(JSON.stringify({
  report: "VANTAGE Deep Search #3 — AI Output Quality Report",
  run,
  analyzedBusinesses: businesses,
  totals: {
    analyzed: businesses.length,
    successful: businesses.filter((item) => item.ai.status === "success").length,
    evidenceItems: evidence.length,
  },
}, null, 2));