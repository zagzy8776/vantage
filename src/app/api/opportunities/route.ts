import { desc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { getDb } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { opportunityEvents, trackedEntities } from "@/lib/opportunity/schema";
import { trackBusiness, untrackBusiness } from "@/lib/opportunity/tracking";

export const dynamic = "force-dynamic";

function tenantVisibility(auth: { userId: string; organizationId?: string | null }) {
  return auth.organizationId
    ? sql`(sra.owner_id = ${auth.userId} OR sra.organization_id = ${auth.organizationId})`
    : sql`sra.owner_id = ${auth.userId}`;
}

function visibleBusinessExists(auth: { userId: string; organizationId?: string | null }, businessId: string) {
  return sql`EXISTS (
    SELECT 1
    FROM search_run_businesses srb
    INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
    WHERE srb.business_id = ${businessId}
      AND ${tenantVisibility(auth)}
  )`;
}

function owner(auth: { userId: string; organizationId?: string | null }) {
  return { userId: auth.userId, organizationId: auth.organizationId ?? null };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? 50);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50, 200));
    const db = getDb();
    const rows = await db.select({
      event: opportunityEvents,
      business: {
        id: businesses.id,
        name: businesses.name,
        category: businesses.category,
        city: businesses.city,
        country: businesses.country,
        website: businesses.website,
        phone: businesses.phone,
      },
    })
      .from(opportunityEvents)
      .innerJoin(trackedEntities, eq(opportunityEvents.trackedEntityId, trackedEntities.id))
      .innerJoin(businesses, eq(trackedEntities.businessId, businesses.id))
      .where(sql`${trackedEntities.active} = true AND ${trackedEntities.ownerId} = ${auth.userId}${auth.organizationId ? sql` AND ${trackedEntities.organizationId} = ${auth.organizationId}` : sql``} AND ${visibleBusinessExists(auth, businesses.id)}`)
      .orderBy(desc(opportunityEvents.createdAt))
      .limit(limit);

    return NextResponse.json({ opportunities: rows }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "opportunities_list_failed", error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Opportunities are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
    const active = body.active !== false;
    if (!businessId) return NextResponse.json({ error: "businessId is required." }, { status: 400 });

    const db = getDb();
    const business = await db.select({ id: businesses.id })
      .from(businesses)
      .where(sql`${businesses.id} = ${businessId} AND ${visibleBusinessExists(auth, businesses.id)}`)
      .limit(1);
    if (!business[0]) return NextResponse.json({ error: "Business not found." }, { status: 404 });

    const tracked = active ? await trackBusiness(businessId, owner(auth)) : await untrackBusiness(businessId, owner(auth));
    return NextResponse.json({ tracked }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "opportunity_tracking_failed", error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Unable to update tracking." }, { status: 503 });
  }
}
