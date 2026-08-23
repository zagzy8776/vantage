import { NextRequest, NextResponse } from "next/server";
import { addMember } from "@/services/collaboration/service";
import type { MemberRole } from "@/services/collaboration/types";
import { requireInvestigationAccess } from "@/auth/middleware";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: investigationId } = await context.params;

  // Tenant isolation: admin access required to manage members
  const auth = await requireInvestigationAccess(request, investigationId, "admin");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    const { userId, userName, userEmail, role } = body;

    if (!userId || !userName || !userEmail || !role) {
      return NextResponse.json(
        { error: "Missing required fields: userId, userName, userEmail, role" },
        { status: 400 }
      );
    }

    const member = addMember(investigationId, userId, userName, userEmail, role as MemberRole);

    // TODO: Save member to database
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Failed to add member:", error);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: investigationId } = await context.params;

  // Tenant isolation: admin access required to manage members
  const auth = await requireInvestigationAccess(request, investigationId, "admin");
  if (auth instanceof NextResponse) return auth;

  try {
    void investigationId;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json(
        { error: "Missing memberId parameter" },
        { status: 400 }
      );
    }

    // TODO: Fetch members from database and remove
    // const members = await getMembers(investigationId);
    // const updatedMembers = removeMember(members, memberId);
    // await saveMembers(updatedMembers);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
