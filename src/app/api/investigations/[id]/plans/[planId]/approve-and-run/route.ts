import { NextRequest, NextResponse } from "next/server";
import { approveInvestigationPlan } from "@/services/investigations/planning/planner";
import { executeInvestigationPlan } from "@/services/investigations/planning/executor";
import { requireAuth, requireRole } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; planId: string }> }) {
  // Require authentication
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Require analyst or higher role to approve and execute plans
  const authorized = await requireRole(request, ["owner", "admin", "analyst"]);
  if (authorized instanceof NextResponse) return authorized;

  try {
    const { id, planId } = await context.params;
    
    // Step 1: Approve the plan (persists to database)
    await approveInvestigationPlan(id, planId);
    
    // Step 2: Execute the plan (only after approval is persisted)
    const queued = await executeInvestigationPlan(id, planId);
    
    return NextResponse.json(queued, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve and execute plan.";
    const status = message === "Plan not found." ? 404 : message.includes("Only approved") || message.includes("already running") ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
