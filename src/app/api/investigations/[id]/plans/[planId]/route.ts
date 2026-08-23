import { NextRequest, NextResponse } from "next/server";
import { editInvestigationPlan, getInvestigationPlan, getPlanExecutions } from "@/services/investigations/planning/planner";
import { validatePlanSteps } from "@/services/investigations/planning/validator";
import type { InvestigationPlanStepInput } from "@/services/investigations/planning/types";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; planId: string }> }) {
  const { id } = await context.params;

  const auth = await requireInvestigationAccess(request, id, "read");
  if (auth instanceof NextResponse) return auth;

  const { planId } = await context.params;
  const plan = await getInvestigationPlan(id, planId);
  return plan ? NextResponse.json({ plan, executions: await getPlanExecutions(id, planId) }) : NextResponse.json({ error: "Plan not found." }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; planId: string }> }) {
  const { id } = await context.params;

  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  try {
    const { planId } = await context.params;
    const body = await request.json().catch(() => null) as { steps?: InvestigationPlanStepInput[]; createdBy?: string } | null;
    if (!body || !Array.isArray(body.steps)) return NextResponse.json({ error: "Plan steps are required." }, { status: 400 });
    const issues = validatePlanSteps(body.steps);
    if (issues.length) return NextResponse.json({ error: "Invalid plan steps.", issues }, { status: 400 });
    return NextResponse.json({ plan: await editInvestigationPlan(id, planId, body.steps, body.createdBy) });
  } catch (error) { const message = error instanceof Error ? error.message : "Failed to edit plan."; return NextResponse.json({ error: message }, { status: message === "Plan not found." ? 404 : 409 }); }
}