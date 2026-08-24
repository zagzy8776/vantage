import { NextRequest, NextResponse } from "next/server";
import { desc, eq, or } from "drizzle-orm";
import { start } from "workflow/api";
import { getDb } from "@/lib/db";
import { searchRuns } from "@/lib/db/schema";
import { searchRunAccess } from "@/services/search-runs/access";
import { claimSearchRunForRecovery, releaseSearchRunLock } from "@/services/search-runs/service";
import { discoveryQueryFromSearchRun } from "@/services/search-runs/service";
import { discoveryRecoveryWorkflow } from "@/workflows/discovery-recovery";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

function newHistoryWorkerId() {
  return `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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
        workerId: searchRuns.workerId,
        lockAcquiredAt: searchRuns.lockAcquiredAt,
      })
      .from(searchRuns)
      .innerJoin(searchRunAccess, eq(searchRunAccess.searchRunId, searchRuns.id))
      .where(visibility)
      .orderBy(desc(searchRuns.createdAt))
      .limit(limit);

    // A scan must not depend on the customer manually waiting for an external
    // cron. If a visible run is still active and its worker lock is stale/missing,
    // recover it immediately from the history request.
    const recoveryWorker = newHistoryWorkerId();
    const staleBoundary = Date.now() - 10 * 60_000;
    for (const run of runs.filter((item) => ["queued", "created", "running"].includes(item.status)).slice(0, 2)) {
      const lockTime = run.lockAcquiredAt ? new Date(run.lockAcquiredAt).getTime() : null;
      if (lockTime !== null && lockTime >= staleBoundary) continue;

      const claimed = await claimSearchRunForRecovery(run.id, recoveryWorker, 10 * 60_000).catch(() => false);
      if (!claimed) continue;

      try {
        const query = discoveryQueryFromSearchRun(run as typeof searchRuns.$inferSelect);
        await start(discoveryRecoveryWorkflow, [query, run.id, recoveryWorker]);
      } catch (error) {
        await releaseSearchRunLock(run.id, recoveryWorker).catch(() => undefined);
        console.error(JSON.stringify({ diagnostic: "history_recovery_failed", runId: run.id, error: error instanceof Error ? error.message : String(error) }));
      }
    }

    return NextResponse.json({ runs }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    return NextResponse.json({ error: "Discovery history is unavailable." }, { status: 503 });
  }
}
