import { NextRequest, NextResponse } from "next/server";
import { analyzeBusinessWebsite } from "@/services/website-analysis/service";
import { requireRole } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Website analysis triggers paid provider calls - analyst access or higher required
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null);
    const businessId = typeof body?.businessId === "string" ? body.businessId.trim() : "";

    if (!businessId) {
      return NextResponse.json({ error: "businessId is required." }, { status: 400 });
    }

    const result = await analyzeBusinessWebsite(businessId);
    return NextResponse.json({ analysis: result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected website analysis error.";

    if (message.includes("Invalid business ID")) {
      return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
    }

    if (message.includes("Business not found")) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    if (message.includes("No website")) {
      return NextResponse.json({ error: "Business has no website to analyze." }, { status: 200 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}