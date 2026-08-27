import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { eq } from "drizzle-orm";
import { requireRole } from "@/auth/middleware";
import { getDb } from "@/lib/db";
import { searchRuns } from "@/lib/db/schema";
import { canAccessSearchRun, recordSearchRunOwner } from "@/services/search-runs/access";
import {
  claimSearchRunForRecovery,
  createSearchRun,
  discoveryQueryFromSearchRun,
  getSearchRun,
  releaseSearchRunLock,
  updateSearchRun,
} from "@/services/search-runs/service";
import { discoveryRecoveryWorkflow } from "@/workflows/discovery-recovery";

export const dynamic = "force-dynamic";

function newWorkerId() {
  return `retry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TERMINAL = new Set(["completed", "completed_with_errors", "failed"]);

export async function POST(request: NextRequest, context: { params: { runId: string } }) {
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  const runId = context.params.runId;
  try {
    const run = await getSearchRun(runId);
    if (!run || !(await canAccessSearchRun(runId, auth))) {
      return NextResponse.json({ error: "Search run not found." }, { status: 404 });
    }

    const query = discoveryQueryFromSearchRun(run);
    // Prefer the discovered count target from the stored result if present.
    const storedLimit =
      typeof (run.result as { limit?: unknown } | null)?.limit === "number"
        ? Number((run.result as { limit: number }).limit)
        : undefined;
    if (storedLimit && storedLimit >= 1 && storedLimit <= 250) {
      query.limit = storedLimit;
    }

    // Failed / finished runs → start a fresh scan with the same query (cleaner).
    if (TERMINAL.has(run.status)) {
      const newId = await createSearchRun(query);
      await recordSearchRunOwner({
        searchRunId: newId,
        ownerId: auth.userId,
        organizationId: auth.organizationId,
      });

      const workerId = newWorkerId();
      const claimed = await claimSearchRunForRecovery(newId, workerId, 0);
      if (!claimed) {
        return NextResponse.json({ error: "Could not start the new scan." }, { status: 500 });
      }

      try {
        const workflowRun = await start(discoveryRecoveryWorkflow, [query, newId, workerId]);
        return NextResponse.json(
          {
            runId: newId,
            previousRunId: runId,
            status: "queued",
            workflowRunId: workflowRun.runId,
            mode: "new_run",
          },
          { status: 202 },
        );
      } catch (error) {
        await releaseSearchRunLock(newId, workerId).catch(() => undefined);
        await getDb().delete(searchRuns).where(eq(searchRuns.id, newId)).catch(() => undefined);
        throw error;
      }
    }

    // Active (queued / running) stuck run → reclaim lock and restart the same run.
    const workerId = newWorkerId();
    // Allow immediate reclaim if never locked; otherwise after 2 minutes of silence.
    const claimed = await claimSearchRunForRecovery(runId, workerId, 2 * 60_000);
    if (!claimed) {
      return NextResponse.json(
        {
          error:
            "This scan is still actively processing. Wait a couple of minutes, then try Retry again.",
        },
        { status: 409 },
      );
    }

    await updateSearchRun(runId, {
      status: "queued",
      completedAt: null,
      durationMs: null,
    });

    try {
      const workflowRun = await start(discoveryRecoveryWorkflow, [query, runId, workerId]);
      return NextResponse.json(
        {
          runId,
          status: "queued",
          workflowRunId: workflowRun.runId,
          mode: "resume",
        },
        { status: 202 },
      );
    } catch (error) {
      await releaseSearchRunLock(runId, workerId).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        diagnostic: "search_run_retry_failed",
        runId,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Could not retry this scan. Please try again in a moment." },
      { status: 500 },
    );
  }
}
