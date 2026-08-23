import { NextRequest, NextResponse } from "next/server";
import { updateActionStatus } from "@/services/investigations/service";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["todo", "in_progress", "completed", "cancelled"] as const;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; actionId: string }> }) {
  const { id } = await context.params;

  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  try {
    const { actionId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { status } = body as { status?: string };
    if (typeof status !== "string" || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid status. Must be one of: todo, in_progress, completed, cancelled." }, { status: 400 });
    }
    const updated = await updateActionStatus(id, actionId, status as (typeof VALID_STATUSES)[number]);
    if (!updated) return NextResponse.json({ error: "Action not found." }, { status: 404 });
    return NextResponse.json({ id: actionId, status }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to update action." }, { status: 500 });
  }
}