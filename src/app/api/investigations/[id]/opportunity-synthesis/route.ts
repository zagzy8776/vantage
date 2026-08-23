import { NextRequest, NextResponse } from "next/server";
import { synthesizeOpportunityInvestigation } from "@/services/investigations/opportunity/synthesizer";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // Tenant isolation: write access required for synthesis
  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  try { const { id } = await context.params; return NextResponse.json({ synthesis: await synthesizeOpportunityInvestigation(id) }, { status: 201 }); }
  catch (error) { const message = error instanceof Error ? error.message : "Opportunity investigation failed."; if (message === "Investigation not found.") return NextResponse.json({ error: message }, { status: 404 }); if (message === "An opportunity synthesis is already running.") return NextResponse.json({ error: message }, { status: 409 }); if (message.includes("No usable evidence")) return NextResponse.json({ error: message }, { status: 422 }); if (message.includes("requires a problem")) return NextResponse.json({ error: message }, { status: 400 }); if (message.includes("No AI provider") || message.includes("configured AI providers")) return NextResponse.json({ error: "Opportunity synthesis AI is unavailable." }, { status: 503 }); return NextResponse.json({ error: "Opportunity investigation failed." }, { status: 502 }); }
}