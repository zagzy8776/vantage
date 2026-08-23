import { NextRequest, NextResponse } from "next/server";
import { analyzeBusinesses } from "@/services/website-analysis/service";
import { requireRole } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Batch analysis triggers paid provider calls - analyst access or higher required
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null);
    const businessIds: string[] = Array.isArray(body?.businessIds)
      ? body.businessIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0).map((value: string) => value.trim())
      : [];

    if (!businessIds.length) {
      return NextResponse.json({ error: "businessIds is required." }, { status: 400 });
    }

    const result = await analyzeBusinesses(businessIds, { force: Boolean(body?.force), limit: 5, maxConcurrency: 2 });
    return NextResponse.json({ batch: result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected batch website analysis error.";
    if (message.includes("Batch analysis is limited")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes("Invalid business ID")) {
      return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}