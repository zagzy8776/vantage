import { NextRequest, NextResponse } from "next/server";
import { getPlanExecutions } from "@/services/investigations/planning/planner";
import { getExecutionStatusView, reconcileInvestigationPlanExecution } from "@/services/investigations/planning/executor";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; planId: string }> }) {
  const { id } = await context.params;

  // Reconciliation can trigger provider calls - write access required
  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  const { planId } = await context.params;
  const latest = (await getPlanExecutions(id, planId))[0];
  if (!latest) return NextResponse.json({ error: "Execution not found." }, { status: 404 });
  await reconcileInvestigationPlanExecution(id, latest.id);
  const { view } = await getExecutionStatusView(id, planId, latest.id);
  return NextResponse.json({ execution: view });
}
