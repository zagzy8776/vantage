import { NextRequest, NextResponse } from "next/server";
import { approveInvestigationPlan } from "@/services/investigations/planning/planner";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; planId: string }> }) {
  const { id } = await context.params;

  // Plan approval gates paid execution - write access required
  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  try { const { planId } = await context.params; return NextResponse.json({ plan: await approveInvestigationPlan(id, planId) }); }
  catch (error) { const message = error instanceof Error ? error.message : "Failed to approve plan."; return NextResponse.json({ error: message }, { status: message === "Plan not found." ? 404 : 409 }); }
}