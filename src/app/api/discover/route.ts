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

    // 1) Reuse a recent completed scan from the DB (no provider API spend).
    //    Results are private to this guest and filtered against businesses they already saw.
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
        // Cache existed but this guest already saw every business → fall through to live search for new ones.
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

    // 2) Persist a private run for this guest.
    const runId = await createSearchRun(query);
    await recordSearchRunOwner({
      searchRunId: runId,
      ownerId: auth.userId,
      organizationId: auth.organizationId,
    });

    // 3) If the same market is already being researched live, still save this guest's run
    //    but note that providers may already be warm — recovery/workflow handles work.
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
          anonymous: Boolean(auth.isAnonymous),
          ownerId: auth.userId,
          activeMatchRunId: active?.id ?? null,
        }),
      );

      return NextResponse.json(
        {
          runId,
          status: "queued",
          workflowRunId: workflowRun.runId,
          ...(active
            ? {
                warning:
                  "Similar research is already running. Your scan is saved and will prioritize businesses you have not seen yet.",
              }
            : {}),
        },
        { status: 202 },
      );
    } catch (workflowError) {
      await releaseSearchRunLock(runId, workerId).catch(() => undefined);
      console.error(
        JSON.stringify({
          diagnostic: "search_run_workflow_start_failed",
          runId,
          message:
            workflowError instanceof Error ? workflowError.message : String(workflowError),
        }),
      );
      return NextResponse.json(
        {
          runId,
          status: "queued",
          warning:
            "Scan saved. Background worker did not start yet — open Your scans and use Retry if it stays queued.",
        },
        { status: 202 },
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return NextResponse.json(
        { error: "Discovery database is unavailable." },
        { status: 503 },
      );
    }
    console.error(
      JSON.stringify({
        diagnostic: "discover_post_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Unexpected discovery error. Please try again.", detail: error instanceof Error ? error.stack : String(error) },
      { status: 500 },
    );
  }
}
