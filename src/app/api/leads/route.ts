import { desc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { businesses, leads } from "@/lib/db/schema";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 100, 200));
    const tenantVisibility = auth.organizationId
      ? sql`(sra.owner_id = ${auth.userId} OR sra.organization_id = ${auth.organizationId})`
      : sql`sra.owner_id = ${auth.userId}`;

    const rows = await getDb()
      .select({
        id: leads.id,
        businessId: businesses.id,
        name: businesses.name,
        category: businesses.category,
        country: businesses.country,
        city: businesses.city,
        region: businesses.region,
        area: businesses.area,
        street: businesses.street,
        website: businesses.website,
        phone: businesses.phone,
        opportunityScore: leads.opportunityScore,
        status: leads.status,
        websiteStatus: leads.websiteStatus,
        reason: leads.reason,
        lastAnalyzedAt: leads.aiAnalyzedAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .innerJoin(businesses, eq(leads.businessId, businesses.id))
      .where(sql`EXISTS (
        SELECT 1
        FROM search_run_businesses srb
        INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
        WHERE srb.business_id = ${businesses.id}
          AND ${tenantVisibility}
      )`)
      .orderBy(desc(leads.opportunityScore), desc(leads.updatedAt))
      .limit(limit);

    return NextResponse.json({ leads: rows }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "leads_scope_failed", error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Leads are temporarily unavailable." }, { status: 503 });
  }
}
