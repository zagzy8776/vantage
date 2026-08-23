import { NextRequest, NextResponse } from "next/server";
import { analyzeLeads } from "@/services/intelligence/lead-analysis";
import { requireRole } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Batch AI analysis triggers paid provider calls - analyst access or higher required
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null);
    const leadIds: string[] = Array.isArray(body?.leadIds) ? body.leadIds.filter((value: unknown): value is string => typeof value === "string" && Boolean(value.trim())).map((value: string) => value.trim()) : [];
    if (!leadIds.length) return NextResponse.json({ error: "leadIds is required." }, { status: 400 });
    return NextResponse.json({ batch: await analyzeLeads(leadIds, { limit: 5, maxConcurrency: 2 }) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected batch intelligence analysis error.";
    if (message.includes("limited")) return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.json({ error: "Batch intelligence analysis failed. Please try again later." }, { status: 502 });
  }
}