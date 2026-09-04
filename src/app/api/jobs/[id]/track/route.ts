import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAuth } from "@/auth/middleware";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
const allowed = new Set(["saved", "applied", "reviewing", "dismissed"]);

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const status = typeof body?.status === "string" && allowed.has(body.status) ? body.status : "saved";
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 5000) : null;
    const db = getDb();
    const exists = await db.execute(sql`SELECT id FROM jobs WHERE id = ${params.id} AND owner_id = ${auth.userId} AND (${auth.organizationId ?? null} IS NULL OR organization_id = ${auth.organizationId ?? null}) LIMIT 1`);
    if (!exists.rows[0]) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO job_tracking (id, job_id, owner_id, organization_id, status, notes)
      VALUES (${id}, ${params.id}, ${auth.userId}, ${auth.organizationId ?? null}, ${status}, ${notes})
      ON CONFLICT (job_id, owner_id) DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = now()
    `);
    return NextResponse.json({ ok: true, status, notes });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "job_track_failed", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Unable to save this job." }, { status: 503 });
  }
}
