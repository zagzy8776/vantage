import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const organizationId = auth.organizationId ?? null;
    const db = getDb();

    const [stats, stageRows, topRows] = await Promise.all([
      db.execute(sql`
        WITH visible_businesses AS (
          SELECT DISTINCT srb.business_id
          FROM search_run_businesses srb
          INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
          WHERE sra.owner_id = ${auth.userId}
             OR (${organizationId} IS NOT NULL AND sra.organization_id = ${organizationId})
        ),
        visible_runs AS (
          SELECT DISTINCT sra.search_run_id
          FROM search_run_access sra
          WHERE sra.owner_id = ${auth.userId}
             OR (${organizationId} IS NOT NULL AND sra.organization_id = ${organizationId})
        )
        SELECT
          (SELECT count(*) FROM visible_businesses) AS "businessesDiscovered",
          (SELECT count(*) FROM website_analyses wa INNER JOIN visible_businesses vb ON vb.business_id = wa.business_id) AS "websitesAnalyzed",
          (SELECT count(*) FROM leads l INNER JOIN visible_businesses vb ON vb.business_id = l.business_id WHERE l.opportunity_score > 79) AS "highOpportunityLeads",
          (SELECT count(*) FROM search_runs sr INNER JOIN visible_runs vr ON vr.search_run_id = sr.id WHERE sr.status IN ('queued','created','running')) AS "activeScans"
      `),
      db.execute(sql`
        WITH visible_businesses AS (
          SELECT DISTINCT srb.business_id
          FROM search_run_businesses srb
          INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
          WHERE sra.owner_id = ${auth.userId}
             OR (${organizationId} IS NOT NULL AND sra.organization_id = ${organizationId})
        )
        SELECT l.status, count(*) AS value
        FROM leads l
        INNER JOIN visible_businesses vb ON vb.business_id = l.business_id
        GROUP BY l.status
      `),
      db.execute(sql`
        WITH visible_businesses AS (
          SELECT DISTINCT srb.business_id
          FROM search_run_businesses srb
          INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
          WHERE sra.owner_id = ${auth.userId}
             OR (${organizationId} IS NOT NULL AND sra.organization_id = ${organizationId})
        )
        SELECT DISTINCT
          l.id,
          b.id AS "businessId",
          b.name,
          b.category,
          b.country,
          b.city,
          b.website,
          l.opportunity_score AS "opportunityScore",
          l.status,
          l.website_status AS "websiteStatus"
        FROM leads l
        INNER JOIN businesses b ON b.id = l.business_id
        INNER JOIN visible_businesses vb ON vb.business_id = b.id
        WHERE l.opportunity_score > 79
        ORDER BY l.opportunity_score DESC
        LIMIT 8
      `),
    ]);

    const account = {
      role: auth.role,
      organizationId: auth.organizationId ?? null,
      anonymous: Boolean(auth.isAnonymous),
    };

    return NextResponse.json({
      stats: stats.rows[0] ?? {
        businessesDiscovered: 0,
        websitesAnalyzed: 0,
        highOpportunityLeads: 0,
        activeScans: 0,
      },
      stages: Object.fromEntries(stageRows.rows.map((row) => [String((row as { status: string }).status), Number((row as { value: string }).value)])),
      topOpportunities: topRows.rows,
      account,
    }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    return NextResponse.json({ error: "Dashboard data is temporarily unavailable." }, { status: 503 });
  }
}
