import { NextRequest, NextResponse } from "next/server";
import { createStandaloneInvestigation } from "@/services/investigations/service";
import { requireRole } from "@/auth/middleware";
import { recordInvestigationOwner } from "@/auth/user-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const result = await createStandaloneInvestigation(body);
    await recordInvestigationOwner({
      investigationId: result.investigationId,
      ownerId: auth.userId,
      organizationId: auth.organizationId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("Invalid") || error.message.includes("Title") || error.message.includes("Objective") || error.message.includes("investigation type") || error.message.includes("Geography") || error.message.includes("Country") || error.message.includes("Problem category") || error.message.includes("Service category") || error.message.includes("industry") || error.message.includes("research question")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json({ error: "Failed to create standalone investigation." }, { status: 500 });
  }
}
