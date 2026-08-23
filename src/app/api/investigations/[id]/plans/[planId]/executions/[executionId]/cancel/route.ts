import { NextRequest, NextResponse } from "next/server";
import { getExecutionStatusView, requestExecutionCancellation } from "@/services/investigations/planning/executor";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; planId: string; executionId: string }> }) {
  const { id } = await context.params;

  // Cancelling affects running paid work - write access required
  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  try {
    const { planId, executionId } = await context.params;
    await requestExecutionCancellation(id, executionId);
    const { view } = await getExecutionStatusView(id, planId, executionId);
    return NextResponse.json({ execution: view });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel execution.";
    return NextResponse.json({ error: message }, { status: message === "Execution not found." || message === "Plan not found." ? 404 : 409 });
  }
}
