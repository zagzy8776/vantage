import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/auth/middleware";
import { canAccessLead } from "@/services/search-runs/access";
import { generateOutreachDraft, markLeadContacted } from "@/services/outreach/draft";

export const dynamic = "force-dynamic";

function isLeadId(value: string) {
  return /^[A-Za-z0-9_-]{1,160}$/.test(value);
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  const leadId = context.params.id?.trim() ?? "";
  if (!isLeadId(leadId)) return NextResponse.json({ error: "Invalid lead ID." }, { status: 400 });
  if (!(await canAccessLead(leadId, auth))) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  try {
    const draft = await generateOutreachDraft(leadId);
    return NextResponse.json({ draft }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Outreach draft failed.";
    if (message.includes("Lead not found")) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    return NextResponse.json({ error: "Could not generate outreach draft. Please try again." }, { status: 502 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  const leadId = context.params.id?.trim() ?? "";
  if (!isLeadId(leadId)) return NextResponse.json({ error: "Invalid lead ID." }, { status: 400 });
  if (!(await canAccessLead(leadId, auth))) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  if (action !== "mark_contacted") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  try {
    await markLeadContacted(leadId);
    return NextResponse.json({ ok: true, status: "contacted" }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    if (message.includes("Lead not found")) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    return NextResponse.json({ error: "Could not update lead status." }, { status: 502 });
  }
}
