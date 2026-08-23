import { NextRequest, NextResponse } from "next/server";
import { getMigrationStatus } from "@/lib/db/migration-check";
import { requireRole } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Migration status exposes database schema details - admin only
  const auth = await requireRole(request, ["owner", "admin"]);
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ status: await getMigrationStatus() }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Migration status is unavailable." }, { status: 503 });
  }
}