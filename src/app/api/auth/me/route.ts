import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { findUserByEmail } from "@/auth/user-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.isAnonymous) {
    return NextResponse.json({
      user: {
        id: auth.userId,
        email: undefined,
        name: "Guest workspace",
        role: auth.role,
        organizationId: undefined,
        anonymous: true,
      },
    }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }

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
        anonymous: false,
      },
    }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
