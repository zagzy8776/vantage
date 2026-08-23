import { NextRequest, NextResponse } from "next/server";
import { createInvestigation, listInvestigations } from "@/services/investigations/service";
import type { InvestigationStatus } from "@/services/investigations/types";
import { unstable_noStore } from "next/cache";
import { requireAuth, requireRole } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Require authentication
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Require analyst or higher role to create investigations
  const authorized = await requireRole(request, ["owner", "admin", "analyst"]);
  if (authorized instanceof NextResponse) return authorized;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const result = await createInvestigation(body);
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

export async function GET(request: Request) {
  try {
    unstable_noStore();
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");
    const status = searchParams.get("status") ?? undefined;
    const validStatuses = ["draft", "active", "completed", "archived"];
    if (status && !validStatuses.includes(status)) return NextResponse.json({ error: "Invalid investigation status." }, { status: 400 });
    const result = await listInvestigations({
      page,
      pageSize,
      search: searchParams.get("search") ?? undefined,
      status: status as InvestigationStatus | undefined,
    });
    return NextResponse.json(result, { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    return NextResponse.json({ error: "Failed to list investigations." }, { status: 500 });
  }
}