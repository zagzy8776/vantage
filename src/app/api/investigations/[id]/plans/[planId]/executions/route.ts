import { NextRequest, NextResponse } from "next/server";
import { getPlanExecutions } from "@/services/investigations/planning/planner";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; planId: string }> }) {
    const { id } = await context.params;
    const auth = await requireInvestigationAccess(request, id, "read");
    if (auth instanceof NextResponse) return auth;

    try {
        const { planId } = await context.params;
        const executions = await getPlanExecutions(id, planId);
        return NextResponse.json({ executions }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch executions.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}