import { NextRequest, NextResponse } from "next/server";
import { executeInvestigationPlan } from "@/services/investigations/planning/executor";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; planId: string }> }) {
  const { id } = await context.params;

  // Execution triggers paid provider work - write access required
  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  try {
    const { planId } = await context.params;
    const queued = await executeInvestigationPlan(id, planId);
    return NextResponse.json(queued, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan execution failed.";
    const status = message === "Plan not found." ? 404 : message.includes("Only approved") || message.includes("already running") ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
