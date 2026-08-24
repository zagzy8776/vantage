import { NextRequest, NextResponse } from "next/server";
import { analyzeBusinesses } from "@/services/website-analysis/service";
import { requireRole } from "@/auth/middleware";
import { canAccessBusiness } from "@/services/search-runs/access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null);
    const businessIds: string[] = Array.isArray(body?.businessIds)
      ? body.businessIds
          .filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
          .map((value: string) => value.trim())
      : [];

    if (!businessIds.length) return NextResponse.json({ error: "businessIds is required." }, { status: 400 });
    if (businessIds.length > 5) return NextResponse.json({ error: "Batch analysis is limited to 5 businesses." }, { status: 400 });

    const accessible: string[] = [];
    for (const businessId of businessIds) {
      if (await canAccessBusiness(businessId, auth)) accessible.push(businessId);
    }

    if (accessible.length !== businessIds.length) {
      return NextResponse.json({ error: "One or more businesses are not accessible from this workspace." }, { status: 404 });
    }

    const result = await analyzeBusinesses(accessible, {
      force: Boolean(body?.force),
      limit: 5,
      maxConcurrency: 2,
    });
    return NextResponse.json({ batch: result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected batch website analysis error.";
    if (message.includes("Batch analysis is limited")) return NextResponse.json({ error: message }, { status: 400 });
    if (message.includes("Invalid business ID")) return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
