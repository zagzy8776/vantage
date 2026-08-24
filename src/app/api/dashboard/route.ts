import { count, desc, eq, gt, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { businesses, leads, searchRuns, websiteAnalyses } from "@/lib/db/schema";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

function visibleBusinessExists(auth: { userId: string; organizationId?: string }) {
  const organizationId = auth.organizationId ?? null;
  return sql`EXISTS (
    SELECT 1
    FROM search_run_businesses srb
    INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
    WHERE srb.business_id = businesses.id
      AND (
        sra.owner_id = ${auth.userId}
        OR (${organizationId} IS NOT NULL AND sra.organization_id = ${organizationId})
      )
  )`;
}

function visibleRunExists(auth: { userId: string; organizationId?: string }) {
  const organizationId = auth.organizationId ?? null;
  return sql`EXISTS (
    SELECT 1
    FROM search_run_access sra
    WHERE sra.search_run_id = search_runs.id
      AND (
        sra.owner_id = ${auth.userId}
        OR (${organizationId} IS NOT NULL AND sra.organization_id = ${organizationId})
      )
  )`;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = getDb();
    const visibleBusiness = visibleBusinessExists(auth);
    const visibleRun = visibleRunExists(auth);

    const [[businessCount], [websiteCount], [highOpportunityCount], [activeScanCount], stageRows, topRows] = await Promise.all([
      db.select({ value: count() }).from(businesses).where(visibleBusiness),
      db.select({ value: count() }).from(websiteAnalyses).where(sql`EXISTS (
        SELECT 1 FROM search_run_businesses srb
        INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
        WHERE srb.business_id = ${websiteAnalyses.businessId}
          AND (sra.owner_id = ${auth.userId} OR (${auth.organizationId ?? null} IS NOT NULL AND sra.organization_id = ${auth.organizationId ?? null}))
      )`),
      db.select({ value: count() }).from(leads).innerJoin(businesses, eq(leads.businessId, businesses.id)).where(sql`${visibleBusiness} AND ${gt(leads.opportunityScore, 79)}`),
      db.select({ value: count() }).from(searchRuns).where(sql`${visibleRun} AND ${sql`${searchRuns.status} IN ('queued','created','running')`}`),
      db.select({ status: leads.status, value: count() }).from(leads).innerJoin(businesses, eq(leads.businessId, businesses.id)).where(visibleBusiness).groupBy(leads.status),
      db.select({
        id: leads.id,
        businessId: businesses.id,
        name: businesses.name,
        category: businesses.category,
        country: businesses.country,
        city: businesses.city,
        website: businesses.website,
        opportunityScore: leads.opportunityScore,
        status: leads.status,
        websiteStatus: leads.websiteStatus,
      }).from(leads).innerJoin(businesses, eq(leads.businessId, businesses.id)).where(sql`${visibleBusiness} AND ${gt(leads.opportunityScore, 79)}`).orderBy(desc(leads.opportunityScore)).limit(8),
    ]);

    return NextResponse.json({
      stats: {
        businessesDiscovered: Number(businessCount?.value ?? 0),
        websitesAnalyzed: Number(websiteCount?.value ?? 0),
        highOpportunityLeads: Number(highOpportunityCount?.value ?? 0),
        activeScans: Number(activeScanCount?.value ?? 0),
      },
      stages: Object.fromEntries(stageRows.map((row) => [row.status, Number(row.value)])),
      topOpportunities: topRows,
      account: { role: auth.role, organizationId: auth.organizationId ?? null, anonymous: Boolean(auth.isAnonymous) },
    }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "dashboard_scope_failed", error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Dashboard data is temporarily unavailable." }, { status: 503 });
  }
}
