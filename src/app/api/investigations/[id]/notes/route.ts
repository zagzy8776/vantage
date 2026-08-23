import { NextRequest, NextResponse } from "next/server";
import { createNote } from "@/services/investigations/service";
import { requireInvestigationAccess } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const auth = await requireInvestigationAccess(request, id, "write");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { author, content } = body as { author?: string; content?: string };
    if (typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Note content is required." }, { status: 400 });
    }
    const note = await createNote(id, {
      author: typeof author === "string" && author.trim().length > 0 ? author.trim() : "Analyst",
      content: content.trim(),
    });
    return NextResponse.json(note, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create note." }, { status: 500 });
  }
}