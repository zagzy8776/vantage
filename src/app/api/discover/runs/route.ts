import { NextRequest, NextResponse } from "next/server";
import { desc, eq, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { searchRuns } from "@/lib/db/schema";
import { searchRunAccess } from "@/services/search-runs/access";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

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
      })
      .from(searchRuns)
      .innerJoin(searchRunAccess, eq(searchRunAccess.searchRunId, searchRuns.id))
      .where(visibility)
      .orderBy(desc(searchRuns.createdAt))
      .limit(limit);

    // History is a read-only endpoint. It must never trigger a provider call,
    // launch a workflow, consume a research credit, or recover a stale run.
    // Recovery is handled by the discovery workflow/external sweep path.
    // Keep the history payload intentionally small: detailed result data is
    // fetched only for the explicitly selected run through the protected
    // single-run endpoint.
    const customerRuns = runs.map((run) => ({
      ...run,
      stages: Object.fromEntries(
        Object.entries((run.stages ?? {}) as Record<string, { status?: string }>)
          .map(([stage, value]) => [stage, { status: value?.status }]),
      ),
    }));

    return NextResponse.json({ runs: customerRuns }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    return NextResponse.json({ error: "Discovery history is unavailable." }, { status: 503 });
  }
}
