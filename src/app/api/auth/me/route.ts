import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { findUserByEmail } from "@/auth/user-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 *
 * Returns the safe identity of the currently authenticated user so the
 * frontend can render auth state without duplicating token logic.
 * Only non-sensitive fields are exposed - never credential material.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const record = await findUserByEmail(auth.email);
    if (!record || !record.isActive) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: record.id,
        email: record.email,
        name: record.name,
        role: record.role,
        organizationId: record.organizationId ?? undefined,
      },
    });
  } catch {
    // Fail closed - cannot confirm the account, treat as unauthenticated
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
