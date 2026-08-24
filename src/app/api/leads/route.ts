import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 100, 200));
    const organizationId = auth.organizationId ?? null;

    const result = await getDb().execute(sql`
      SELECT DISTINCT
        l.id,
        b.id AS "businessId",
        b.name,
        b.category,
        b.country,
        b.city,
        b.region,
        b.area,
        b.street,
        b.website,
        b.phone,
        l.opportunity_score AS "opportunityScore",
        l.status,
        l.website_status AS "websiteStatus",
        l.reason,
        l.ai_analyzed_at AS "lastAnalyzedAt",
        l.updated_at AS "updatedAt"
      FROM leads l
      INNER JOIN businesses b ON b.id = l.business_id
      INNER JOIN search_run_businesses srb ON srb.business_id = b.id
      INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
      WHERE (
        sra.owner_id = ${auth.userId}
        OR (${organizationId} IS NOT NULL AND sra.organization_id = ${organizationId})
      )
      ORDER BY l.opportunity_score DESC, l.updated_at DESC
      LIMIT ${limit}
    `);

    return NextResponse.json({ leads: result.rows }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    return NextResponse.json({ error: "Leads are temporarily unavailable." }, { status: 503 });
  }
}
