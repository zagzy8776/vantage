import { NextRequest, NextResponse } from "next/server";
import { analyzeLead } from "@/services/intelligence/lead-analysis";
import { requireRole } from "@/auth/middleware";
import { canAccessLead } from "@/services/search-runs/access";

export const dynamic = "force-dynamic";

function customerIntelligence(intelligence: Awaited<ReturnType<typeof analyzeLead>>) {
  const { id, leadId, businessId, businessSummary, opportunityLevel, opportunityScore, strengths, weaknesses, opportunities, risks, recommendedServices, evidence, unknowns, reasoning, confidence, validationStatus, createdAt } = intelligence;
  return { id, leadId, businessId, businessSummary, opportunityLevel, opportunityScore, strengths, weaknesses, opportunities, risks, recommendedServices, evidence, unknowns, reasoning, confidence, validationStatus, createdAt };
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json().catch(() => null);
    const leadId = typeof body?.leadId === "string" ? body.leadId.trim() : "";
    if (!leadId) return NextResponse.json({ error: "leadId is required." }, { status: 400 });
    if (!(await canAccessLead(leadId, auth))) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    return NextResponse.json({ intelligence: customerIntelligence(await analyzeLead(leadId)) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected intelligence analysis error.";
    if (message.includes("Invalid lead ID")) return NextResponse.json({ error: "Invalid lead ID." }, { status: 400 });
    if (message.includes("Lead not found")) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    if (message.includes("No AI provider") || message.includes("configured AI providers")) return NextResponse.json({ error: "AI analysis is not configured or temporarily unavailable." }, { status: 503 });
    return NextResponse.json({ error: "AI analysis failed. Please try again later." }, { status: 502 });
  }
}
