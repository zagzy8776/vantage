import { NextRequest, NextResponse } from "next/server";
import { analyzeLeads, type StoredLeadIntelligence } from "@/services/intelligence/lead-analysis";
import { requireRole } from "@/auth/middleware";
import { canAccessLead } from "@/services/search-runs/access";

export const dynamic = "force-dynamic";

function customerIntelligence(intelligence: StoredLeadIntelligence) {
  const { id, leadId, businessId, businessSummary, opportunityLevel, opportunityScore, strengths, weaknesses, opportunities, risks, recommendedServices, evidence, unknowns, reasoning, confidence, validationStatus, createdAt } = intelligence;
  return { id, leadId, businessId, businessSummary, opportunityLevel, opportunityScore, strengths, weaknesses, opportunities, risks, recommendedServices, evidence, unknowns, reasoning, confidence, validationStatus, createdAt };
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json().catch(() => null);
    const leadIds: string[] = Array.isArray(body?.leadIds) ? body.leadIds.filter((value: unknown): value is string => typeof value === "string" && Boolean(value.trim())).map((value: string) => value.trim()) : [];
    if (!leadIds.length) return NextResponse.json({ error: "leadIds is required." }, { status: 400 });
    if (leadIds.length > 5) return NextResponse.json({ error: "Batch intelligence analysis is limited to 5 leads." }, { status: 400 });
    for (const leadId of leadIds) if (!(await canAccessLead(leadId, auth))) return NextResponse.json({ error: "One or more leads are not accessible from this workspace." }, { status: 404 });
    const batch = await analyzeLeads(leadIds, { limit: 5, maxConcurrency: 2 });
    return NextResponse.json({ batch: { ...batch, results: batch.results.map((result) => "error" in result ? result : customerIntelligence(result)) } }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected batch intelligence analysis error.";
    if (message.includes("limited")) return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.json({ error: "Batch intelligence analysis failed. Please try again later." }, { status: 502 });
  }
}
