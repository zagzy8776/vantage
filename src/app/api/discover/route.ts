import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { validateDiscoveryQuery } from "@/lib/discover/validation";
import { createSearchRun } from "@/services/search-runs/service";
import { claimSearchRunForRecovery, releaseSearchRunLock } from "@/services/search-runs/service";
import { recordSearchRunOwner } from "@/services/search-runs/access";
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

    // Persist the scan first. Never delete it if the background worker fails —
    // the user must still see it under Your scans and can Retry.
    const runId = await createSearchRun(validation.query);
    await recordSearchRunOwner({
      searchRunId: runId,
      ownerId: auth.userId,
      organizationId: auth.organizationId,
    });

    const workerId = newWorkerId();
    const claimed = await claimSearchRunForRecovery(runId, workerId, 0);

    if (!claimed) {
      // Run is saved; another worker may already own it. Surface the id.
      return NextResponse.json(
        {
          runId,
          status: "queued",
          warning: "Scan saved. Background worker will pick it up shortly.",
        },
        { status: 202 },
      );
    }

    try {
      const workflowRun = await start(discoveryRecoveryWorkflow, [
        validation.query,
        runId,
        workerId,
      ]);
      console.info(
        JSON.stringify({
          diagnostic: "search_run_workflow_started",
          runId,
          workflowRunId: workflowRun.runId,
          worker: workerId,
          anonymous: Boolean(auth.isAnonymous),
          ownerId: auth.userId,
        }),
      );

      return NextResponse.json(
        { runId, status: "queued", workflowRunId: workflowRun.runId },
        { status: 202 },
      );
    } catch (workflowError) {
      // Keep the scan. Release the lock so Retry / sweep can reclaim it.
      await releaseSearchRunLock(runId, workerId).catch(() => undefined);
      console.error(
        JSON.stringify({
          diagnostic: "search_run_workflow_start_failed",
          runId,
          message:
            workflowError instanceof Error
              ? workflowError.message
              : String(workflowError),
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
      { error: "Unexpected discovery error. Please try again." },
      { status: 500 },
    );
  }
}
