import { getDb } from "@/lib/db";
import { searchRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type SearchRunEligibility = "eligible" | "not_terminal" | "not_found";

export async function validateSearchRunForInvestigation(searchRunId: string): Promise<SearchRunEligibility> {
  const run = await getDb().select({ status: searchRuns.status }).from(searchRuns).where(eq(searchRuns.id, searchRunId)).limit(1);
  if (!run[0]) return "not_found";
  const terminalStatuses = ["completed", "completed_with_errors"];
  return terminalStatuses.includes(run[0].status) ? "eligible" : "not_terminal";
}

export function isValidInvestigationType(type: string): type is "company" | "industry" | "market" | "problem" | "service_opportunity" {
  return ["company", "industry", "market", "problem", "service_opportunity"].includes(type);
}

export function validateEvidenceIds(evidenceIds: string[]): boolean {
  return evidenceIds.every((id) => typeof id === "string" && id.length > 0);
}

export function validateCreateInvestigationInput(input: unknown): { ok: boolean; error?: string; data?: { title: string; objective: string; investigationType: string; searchRunId?: string; criteria: Record<string, unknown> | null } } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid input: expected an object." };
  const { title, objective, investigationType, searchRunId, criteria } = input as Record<string, unknown>;
  if (typeof title !== "string" || title.trim().length === 0) return { ok: false, error: "Title is required." };
  if (typeof objective !== "string" || objective.trim().length === 0) return { ok: false, error: "Objective is required." };
  if (typeof investigationType !== "string" || !isValidInvestigationType(investigationType)) return { ok: false, error: "Invalid investigation type." };
  if (searchRunId !== undefined && (typeof searchRunId !== "string" || searchRunId.trim().length === 0)) return { ok: false, error: "Invalid search run ID." };
  if (criteria !== undefined && (typeof criteria !== "object" || criteria === null || Array.isArray(criteria))) return { ok: false, error: "Invalid investigation criteria." };
  return { ok: true, data: { title: title.trim(), objective: objective.trim(), investigationType, searchRunId: searchRunId ? searchRunId.trim() : undefined, criteria: (criteria as Record<string, unknown> | undefined) ?? null } };
}

export function validateStandaloneInvestigationInput(input: unknown): { ok: boolean; error?: string; data?: { title: string; objective: string; investigationType: string; industry?: string; geography: { country?: string; region?: string; city?: string }; problemCategory?: string; serviceCategory?: string; researchQuestion?: string; criteria?: Record<string, unknown> } } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid input: expected an object." };
  const { title, objective, investigationType, industry, geography, problemCategory, serviceCategory, researchQuestion, criteria } = input as Record<string, unknown>;
  if (typeof title !== "string" || title.trim().length === 0) return { ok: false, error: "Title is required." };
  if (typeof objective !== "string" || objective.trim().length === 0) return { ok: false, error: "Objective is required." };
  if (typeof investigationType !== "string" || !isValidInvestigationType(investigationType)) return { ok: false, error: "Invalid investigation type." };
  
  // Validate problem category for problem investigations
  if (investigationType === "problem" && (!problemCategory || typeof problemCategory !== "string" || problemCategory.trim().length === 0)) {
    return { ok: false, error: "Problem category is required for problem investigations." };
  }
  
  // Validate service category for service opportunity investigations
  if (investigationType === "service_opportunity" && (!serviceCategory || typeof serviceCategory !== "string" || serviceCategory.trim().length === 0)) {
    return { ok: false, error: "Service category is required for service opportunity investigations." };
  }
  
  // Validate geography
  if (!geography || typeof geography !== "object" || geography === null || Array.isArray(geography)) {
    return { ok: false, error: "Geography is required." };
  }
  const geo = geography as Record<string, unknown>;
  if (!geo.country || typeof geo.country !== "string" || geo.country.trim().length === 0) {
    return { ok: false, error: "Country is required in geography." };
  }
  
  // Optional fields validation
  if (industry !== undefined && (typeof industry !== "string" || industry.trim().length === 0)) {
    return { ok: false, error: "Invalid industry." };
  }
  if (researchQuestion !== undefined && (typeof researchQuestion !== "string" || researchQuestion.trim().length === 0)) {
    return { ok: false, error: "Invalid research question." };
  }
  if (criteria !== undefined && (typeof criteria !== "object" || criteria === null || Array.isArray(criteria))) {
    return { ok: false, error: "Invalid investigation criteria." };
  }
  
  return { 
    ok: true, 
    data: { 
      title: title.trim(), 
      objective: objective.trim(), 
      investigationType, 
      industry: industry?.trim(), 
      geography: { 
        country: geo.country.trim(), 
        region: geo.region ? String(geo.region).trim() : undefined, 
        city: geo.city ? String(geo.city).trim() : undefined 
      }, 
      problemCategory: problemCategory ? String(problemCategory).trim() : undefined, 
      serviceCategory: serviceCategory ? String(serviceCategory).trim() : undefined, 
      researchQuestion: researchQuestion ? String(researchQuestion).trim() : undefined, 
      criteria: criteria as Record<string, unknown> | undefined 
    } 
  };
}