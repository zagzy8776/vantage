import { NextRequest, NextResponse } from "next/server";
import { getPlanExecutions } from "@/services/investigations/planning/planner";
import { getExecutionStatusView, runInvestigationExecutionWorker } from "@/services/investigations/planning/executor";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; planId: string; executionId: string }> }) {
  const { id } = await context.params;

  const auth = await requireInvestigationAccess(request, id, "read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { planId, executionId } = await context.params;
    const existing = (await getPlanExecutions(id, planId)).find((execution) => execution.id === executionId);
    if (!existing) return NextResponse.json({ error: "Execution not found." }, { status: 404 });
    if (existing.status === "queued" || existing.status === "running") void runInvestigationExecutionWorker(id, executionId).catch(() => undefined);
    const { view } = await getExecutionStatusView(id, planId, executionId);
    return NextResponse.json({ execution: view });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve execution status.";
    return NextResponse.json({ error: message }, { status: message === "Execution not found." || message === "Plan not found." ? 404 : 500 });
  }
}
