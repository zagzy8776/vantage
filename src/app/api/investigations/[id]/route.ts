import { NextRequest, NextResponse } from "next/server";
import { getInvestigationDetail, updateInvestigation } from "@/services/investigations/service";
import { unstable_noStore } from "next/cache";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["draft", "active", "completed", "archived"] as const;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // Tenant isolation: read access required
  const auth = await requireInvestigationAccess(request, id, "read");
  if (auth instanceof NextResponse) return auth;

  try {
    unstable_noStore();
    const includeEvidence = new URL(request.url).searchParams.get("includeEvidence") === "true";
    const investigation = await getInvestigationDetail(id, { includeEvidence });
    if (!investigation) return NextResponse.json({ error: "Investigation not found." }, { status: 404 });
    
    return NextResponse.json(investigation, { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    return NextResponse.json({ error: "Failed to retrieve investigation." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // Tenant isolation: write access required to update
  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { title, objective, status } = body as { title?: string; objective?: string; status?: string };
    if (status !== undefined && (typeof status !== "string" || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number]))) {
      return NextResponse.json({ error: "Invalid status. Must be one of: draft, active, completed, archived." }, { status: 400 });
    }
    if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
      return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
    }
    if (objective !== undefined && (typeof objective !== "string" || objective.trim().length === 0)) {
      return NextResponse.json({ error: "Objective cannot be empty." }, { status: 400 });
    }
    const updated = await updateInvestigation(id, {
      ...(title !== undefined ? { title } : {}),
      ...(objective !== undefined ? { objective } : {}),
      ...(status !== undefined ? { status: status as (typeof VALID_STATUSES)[number] } : {}),
    });
    if (!updated) return NextResponse.json({ error: "Investigation not found." }, { status: 404 });
    return NextResponse.json({ id, ...(title !== undefined ? { title } : {}), ...(objective !== undefined ? { objective } : {}), ...(status !== undefined ? { status } : {}) }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to update investigation." }, { status: 500 });
  }
}