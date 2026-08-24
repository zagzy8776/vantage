import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.isAnonymous) return NextResponse.json({ error: "Guest profiles cannot be edited." }, { status: 403 });

  const body = await request.json().catch(() => null) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "Name must be between 2 and 120 characters." }, { status: 400 });
  }

  try {
    const rows = await getDb().update(users)
      .set({ name })
      .where(eq(users.id, auth.userId))
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role, organizationId: users.organizationId });
    const user = rows[0];
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    return NextResponse.json({ user: { ...user, anonymous: false } }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not update your profile." }, { status: 500 });
  }
}
