import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { validateDiscoveryQuery } from "@/lib/discover/validation";
import { createSearchRun } from "@/services/search-runs/service";
import { claimSearchRunForRecovery, releaseSearchRunLock } from "@/services/search-runs/service";
import { recordSearchRunOwner } from "@/services/search-runs/access";
import {
  findActiveMatchingRun,
  findReusableCompletedRun,
  forkCachedSearchRun,
} from "@/services/search-runs/cache";
import { discoveryRecoveryWorkflow } from "@/workflows/discovery-recovery";
import { requireRole } from "@/auth/middleware";

export const dynamic = "force-dynamic";

function newWorkerId() {
  return `discover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null);
    const validation = validateDiscoveryQuery(body ?? {});
    if (!validation.ok || !validation.query) {
      return NextResponse.json(
        { error: validation.errors[0] ?? "Invalid discovery query." },
        { status: 400 },
      );
    }

    const query = validation.query;

    // Deep discovery is intended to be a fresh research pass. Reusing a completed
    // market scan here makes live Discover results look stale and prevents provider refresh.
    if (query.depth !== "deep") {
      try {
        const cached = await findReusableCompletedRun(query);
        if (cached) {
          const forked = await forkCachedSearchRun({
            sourceRunId: cached.id,
            query,
            ownerId: auth.userId,
            organizationId: auth.organizationId,
          });
          if (forked && forked.resultCount > 0) {
            console.info(
              JSON.stringify({
                diagnostic: "search_run_cache_hit",
                runId: forked.runId,
                sourceRunId: forked.sourceRunId,
                resultCount: forked.resultCount,
                ownerId: auth.userId,
              }),
            );
            return NextResponse.json(
              {
                runId: forked.runId,
                status: "completed",
                cacheHit: true,
                message: "Loaded from saved research — no new provider calls.",
              },
              { status: 200 },
            );
          }
          console.info(
            JSON.stringify({
              diagnostic: "search_run_cache_exhausted",
              sourceRunId: cached.id,
              ownerId: auth.userId,
            }),
          );
        }
      } catch (cacheError) {
        console.error(
          JSON.stringify({
            diagnostic: "search_run_cache_failed",
            message: cacheError instanceof Error ? cacheError.message : String(cacheError),
          }),
        );
      }
    }

    const runId = await createSearchRun(query);
    await recordSearchRunOwner({
      searchRunId: runId,
      ownerId: auth.userId,
      organizationId: auth.organizationId,
    });

    const active = await findActiveMatchingRun(query).catch(() => null);

    const workerId = newWorkerId();
    const claimed = await claimSearchRunForRecovery(runId, workerId, 0);

    if (!claimed) {
      return NextResponse.json(
        {
          runId,
          status: "queued",
          warning: "Scan saved. Background worker will pick it up shortly.",
          activeMatchRunId: active?.id,
        },
        { status: 202 },
      );
    }

    try {
      const workflowRun = await start(discoveryRecoveryWorkflow, [query, runId, workerId]);
      console.info(
        JSON.stringify({
          diagnostic: "search_run_workflow_started",
          runId,
          workflowRunId: workflowRun.runId,
          worker: workerId,
        }),
      );
      return NextResponse.json(
        {
          runId,
          status: "queued",
          workflowRunId: workflowRun.runId,
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
        diagnostic: "search_run_create_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Could not start discovery. Please try again in a moment." },
      { status: 500 },
    );
  }
}
