import { NextRequest, NextResponse } from "next/server";
import { count, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { businesses, leads, searchRuns, websiteAnalyses } from "@/lib/db/schema";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

/** Customer dashboard data. Never falls back to demo/mock records. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = getDb();

    const [businessCount] = await db.select({ value: count() }).from(businesses);
    const [websiteCount] = await db.select({ value: count() }).from(websiteAnalyses);
    const [highOpportunityCount] = await db
      .select({ value: count() })
      .from(leads)
      .where(gt(leads.opportunityScore, 79));
    const [activeScanCount] = await db
      .select({ value: count() })
      .from(searchRuns)
      .where(eq(searchRuns.status, "running"));

    const stageRows = await db
      .select({ status: leads.status, value: count() })
      .from(leads)
      .groupBy(leads.status);

    const topRows = await db
      .select({
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
      })
      .from(leads)
      .innerJoin(businesses, eq(leads.businessId, businesses.id))
      .where(gt(leads.opportunityScore, 79))
      .orderBy(desc(leads.opportunityScore))
      .limit(8);

    const stages = Object.fromEntries(stageRows.map((row) => [row.status, row.value]));

    return NextResponse.json({
      stats: {
        businessesDiscovered: businessCount.value,
        websitesAnalyzed: websiteCount.value,
        highOpportunityLeads: highOpportunityCount.value,
        activeScans: activeScanCount.value,
      },
      stages,
      topOpportunities: topRows,
      account: { role: auth.role, organizationId: auth.organizationId ?? null },
    }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    return NextResponse.json({ error: "Dashboard data is temporarily unavailable." }, { status: 503 });
  }
}
