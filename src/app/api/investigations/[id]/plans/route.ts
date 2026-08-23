import { NextRequest, NextResponse } from "next/server";
import { createInvestigationPlan, getInvestigationPlans } from "@/services/investigations/planning/planner";
import { validatePlanSteps } from "@/services/investigations/planning/validator";
import type { InvestigationPlanStepInput } from "@/services/investigations/planning/types";
import { requireAuth, requireRole } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Require authentication
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try { const { id } = await context.params; return NextResponse.json({ plans: await getInvestigationPlans(id) }); }
  catch { return NextResponse.json({ error: "Failed to retrieve investigation plans." }, { status: 500 }); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Require authentication
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Require analyst or higher role to create plans
  const authorized = await requireRole(request, ["owner", "admin", "analyst"]);
  if (authorized instanceof NextResponse) return authorized;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as { steps?: InvestigationPlanStepInput[]; createdBy?: string };
    if (body.steps !== undefined && (!Array.isArray(body.steps) || validatePlanSteps(body.steps).length > 0)) return NextResponse.json({ error: "Invalid plan steps.", issues: Array.isArray(body.steps) ? validatePlanSteps(body.steps) : [] }, { status: 400 });
    return NextResponse.json({ plan: await createInvestigationPlan(id, body) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create investigation plan.";
    return NextResponse.json({ error: message }, { status: message === "Investigation not found." ? 404 : 400 });
  }
}