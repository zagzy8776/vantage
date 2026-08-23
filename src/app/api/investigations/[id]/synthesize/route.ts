import { NextRequest, NextResponse } from "next/server";
import { synthesizeInvestigation } from "@/services/investigations/synthesis/synthesizer";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // Tenant isolation: write access required for synthesis
  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const summary = await synthesizeInvestigation(id);
    return NextResponse.json({ synthesis: summary }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Investigation synthesis failed.";
    if (message === "Investigation not found.") return NextResponse.json({ error: message }, { status: 404 });
    if (message === "An investigation synthesis is already running.") return NextResponse.json({ error: message }, { status: 409 });
    if (message === "No usable evidence is available for synthesis.") return NextResponse.json({ error: message }, { status: 422 });
    if (message.includes("No AI provider") || message.includes("configured AI providers")) return NextResponse.json({ error: "Synthesis AI is not configured or temporarily unavailable." }, { status: 503 });
    return NextResponse.json({ error: "Investigation synthesis failed." }, { status: 502 });
  }
}