import { NextRequest, NextResponse } from "next/server";
import { createInvestigation, listInvestigations } from "@/services/investigations/service";
import type { InvestigationStatus } from "@/services/investigations/types";
import { unstable_noStore } from "next/cache";
import { requireAuth, requireRole } from "@/auth/middleware";
import { getInvestigationAccessInfo } from "@/auth/user-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const authorized = await requireRole(request, ["owner", "admin", "analyst"]);
  if (authorized instanceof NextResponse) return authorized;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const result = await createInvestigation(body);
    const { recordInvestigationOwner } = await import("@/auth/user-store");
    await recordInvestigationOwner({
      investigationId: result.investigationId,
      ownerId: auth.userId,
      organizationId: auth.organizationId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Search run not found.") return NextResponse.json({ error: error.message }, { status: 404 });
      if (error.message === "Search run is not in a terminal state. Only completed or completed_with_errors runs can be used.") return NextResponse.json({ error: error.message }, { status: 400 });
      if (error.message.startsWith("Invalid") || error.message.includes("Title") || error.message.includes("Objective") || error.message.includes("investigation type") || error.message.includes("Search run ID")) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create investigation." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    unstable_noStore();
    const { searchParams } = new URL(request.url);
    const requestedPage = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));
    const status = searchParams.get("status") ?? undefined;
    const validStatuses = ["draft", "active", "completed", "archived"];
    if (status && !validStatuses.includes(status)) return NextResponse.json({ error: "Invalid investigation status." }, { status: 400 });

    // listInvestigations predates tenant isolation and reads the base table.
    // Load the bounded result set server-side, then enforce access before any
    // investigation data leaves this route. This also honors explicit shares.
    const all = await listInvestigations({
      page: 1,
      pageSize: 100,
      search: searchParams.get("search") ?? undefined,
      status: status as InvestigationStatus | undefined,
    });

    const visible = [] as typeof all.items;
    for (const item of all.items) {
      const access = await getInvestigationAccessInfo(item.id);
      if (!access) continue;
      const isOwner = access.ownerId === auth.userId;
      const sameOrganization = Boolean(access.organizationId && auth.organizationId && access.organizationId === auth.organizationId);
      const shared = access.sharedWith.some((entry) => entry.userId === auth.userId);
      if (isOwner || sameOrganization || shared || auth.role === "owner" || auth.role === "admin") visible.push(item);
    }

    const total = visible.length;
    const start = (requestedPage - 1) * pageSize;
    const items = visible.slice(start, start + pageSize);

    return NextResponse.json({
      items,
      total,
      page: requestedPage,
      pageSize,
    }, { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    return NextResponse.json({ error: "Failed to list investigations." }, { status: 500 });
  }
}
