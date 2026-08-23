import { NextRequest, NextResponse } from "next/server";
import { removeInvestigationBusiness, updateInvestigationBusinessRole } from "@/services/investigations/service";
import type { InvestigationBusinessRole } from "@/services/investigations/types";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["primary", "comparison", "candidate", "excluded"] as const;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; businessId: string }> }) {
  const { id } = await context.params;
  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  try {
    const { businessId } = await context.params;
    const body = await request.json().catch(() => null);
    const role = body && typeof body === "object" ? (body as { role?: string }).role : undefined;
    if (!role || !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role. Must be one of: primary, comparison, candidate, excluded." }, { status: 400 });
    }
    const updated = await updateInvestigationBusinessRole(id, businessId, role as InvestigationBusinessRole);
    if (!updated) return NextResponse.json({ error: "Investigation business relationship not found." }, { status: 404 });
    return NextResponse.json({ investigationId: id, businessId, role }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to review business relationship." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; businessId: string }> }) {
  const { id } = await context.params;
  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  try {
    const { businessId } = await context.params;
    const removed = await removeInvestigationBusiness(id, businessId);
    if (!removed) return NextResponse.json({ error: "Investigation business relationship not found." }, { status: 404 });
    return NextResponse.json({ investigationId: id, businessId, removed: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to remove business from investigation." }, { status: 500 });
  }
}