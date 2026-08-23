import type { InvestigationObjectiveSnapshot, InvestigationPlanStepInput } from "./types";

const problemCategories: Record<string, { categories: string[]; signals: string[]; questions: string[] }> = {
  appointment_no_shows: {
    categories: ["beauty salons", "hair salons", "nail salons", "spas"],
    signals: ["booking links", "cancellation policies", "appointment-related reviews", "booking platforms", "public scheduling workflows"],
    questions: ["Is an appointment workflow observable?", "Are cancellation/no-show policies published?", "Are appointment-related complaints present?", "Does the booking path appear functional?", "What remains unknown?"],
  },
};

function baseSteps(snapshot: InvestigationObjectiveSnapshot, category: string | undefined): InvestigationPlanStepInput[] {
  const problem = category ? problemCategories[category] : undefined;
  const categories = problem?.categories ?? [snapshot.targetIndustry ?? "relevant businesses"];
  const signals = problem?.signals ?? ["public business evidence", "website and contact evidence"];
  const questions = problem?.questions ?? ["What is established by public evidence?", "What remains unknown?"];
  return [
    { order: 1, type: "interpret_objective", title: "Interpret investigation objective", objective: snapshot.objective, reason: "Freeze the structured objective before external work begins.", configuration: { questions }, dependencies: [], budget: {}, enabled: true },
    { order: 2, type: "discover_businesses", title: "Discover relevant businesses", objective: `Find businesses in ${categories.join(", ")}.`, reason: "Build the candidate sample for this investigation.", configuration: { categories, providers: ["foursquare", "yelp"], searchSource: "best-available", depth: "deep", evidenceEnrichment: true, queryExpansion: true, signals }, dependencies: [], budget: { businessProviderQueries: Math.min(8, Math.max(1, categories.length * 2)), candidates: 20, firecrawlPages: 5, pagespeedAnalyses: 5, totalExternalRequests: 16 }, enabled: true },
    { order: 3, type: "collect_evidence", title: "Collect problem-relevant evidence", objective: `Look for ${signals.join(", ")}.`, reason: "Classify observable signals without treating them as proof of the underlying problem.", configuration: { signals, questions, providers: ["tavily", "exa", "firecrawl", "pagespeed"] }, dependencies: ["2"], budget: { webSearchQueries: 8, firecrawlPages: 5, totalExternalRequests: 13 }, enabled: true },
    { order: 4, type: snapshot.investigationType === "problem" ? "synthesize_problem" : "synthesize_market", title: snapshot.investigationType === "problem" ? "Synthesize problem signals" : "Synthesize market patterns", objective: "Interpret validated evidence into bounded findings, hypotheses, unknowns, and actions.", reason: "Produce auditable conclusions only after evidence collection.", configuration: { questions }, dependencies: ["2", "3"], budget: { aiCalls: 1, totalExternalRequests: 1 }, enabled: true },
  ];
}

export function buildPlanTemplate(snapshot: InvestigationObjectiveSnapshot): InvestigationPlanStepInput[] {
  return baseSteps(snapshot, snapshot.problemCategory);
}

export function getProblemTemplate(category: string) { return problemCategories[category] ?? null; }