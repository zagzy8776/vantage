import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { businesses, leads } from "@/lib/db/schema";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

/** Customer-facing leads. No mock/demo fallback. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 100, 200));

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
      .orderBy(desc(leads.opportunityScore), desc(leads.updatedAt))
      .limit(limit);

    return NextResponse.json({ leads: rows }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    return NextResponse.json({ error: "Leads are temporarily unavailable." }, { status: 503 });
  }
}
