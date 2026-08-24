import { NextRequest, NextResponse } from "next/server";
import { desc, eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { searchRuns } from "@/lib/db/schema";
import { searchRunAccess } from "@/services/search-runs/access";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

/**
 * GET /api/discover/runs
 *
 * Returns only research explicitly owned by the authenticated user or their
 * organization. Legacy/ownerless rows are intentionally excluded so a new
 * workspace never opens with somebody else's searches or demo data.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? 20);
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20, 50));

    const visibility = auth.organizationId
      ? or(
          eq(searchRunAccess.ownerId, auth.userId),
          eq(searchRunAccess.organizationId, auth.organizationId),
        )
      : eq(searchRunAccess.ownerId, auth.userId);

    const runs = await getDb()
      .select({
        id: searchRuns.id,
        query: searchRuns.query,
        country: searchRuns.country,
        city: searchRuns.city,
        depth: searchRuns.depth,
        status: searchRuns.status,
        discoveredCount: searchRuns.discoveredCount,
        enrichedCount: searchRuns.enrichedCount,
        verifiedCount: searchRuns.verifiedCount,
        durationMs: searchRuns.durationMs,
        createdAt: searchRuns.createdAt,
        startedAt: searchRuns.startedAt,
        completedAt: searchRuns.completedAt,
        stages: searchRuns.stages,
        result: searchRuns.result,
      })
      .from(searchRuns)
      .innerJoin(searchRunAccess, eq(searchRunAccess.searchRunId, searchRuns.id))
      .where(visibility)
      .orderBy(desc(searchRuns.createdAt))
      .limit(limit);

    return NextResponse.json({ runs }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    return NextResponse.json({ error: "Discovery history is unavailable." }, { status: 503 });
  }
}
