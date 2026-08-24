import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { validateDiscoveryQuery } from "@/lib/discover/validation";
import { createSearchRun } from "@/services/search-runs/service";
import { claimSearchRunForRecovery, releaseSearchRunLock } from "@/services/search-runs/service";
import { recordSearchRunOwner } from "@/services/search-runs/access";
import { discoveryRecoveryWorkflow } from "@/workflows/discovery-recovery";
import { getResearchPlanForUser, refundResearchCredit, reserveResearchCredit } from "@/services/research-credits/service";
import { requireRole } from "@/auth/middleware";
import { getDb } from "@/lib/db";
import { searchRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
      return NextResponse.json({ error: validation.errors[0] ?? "Invalid discovery query." }, { status: 400 });
    }

    const billable = !auth.isAnonymous;
    const plan = billable ? await getResearchPlanForUser(auth.userId, auth.organizationId) : "free";
    const reservationRunId = `reservation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (billable) {
      const reservation = await reserveResearchCredit({ userId: auth.userId, plan, searchRunId: reservationRunId });
      if (!reservation.ok) {
        return NextResponse.json({
          error: "Research limit reached.",
          code: "RESEARCH_CREDITS_EXHAUSTED",
          credits: { remaining: reservation.remaining, limit: reservation.limit },
        }, { status: 402 });
      }
    }

    let runId: string | null = null;
    let workerId: string | null = null;
    try {
      runId = await createSearchRun(validation.query);
      await recordSearchRunOwner({
        searchRunId: runId,
        ownerId: auth.userId,
        organizationId: auth.organizationId,
      });

      workerId = newWorkerId();
      const claimed = await claimSearchRunForRecovery(runId, workerId, 0);
      if (!claimed) throw new Error("Could not claim the new search run.");

      const workflowRun = await start(discoveryRecoveryWorkflow, [validation.query, runId, workerId]);
      console.info(JSON.stringify({
        diagnostic: "search_run_workflow_started",
        runId,
        workflowRunId: workflowRun.runId,
        worker: workerId,
        anonymous: Boolean(auth.isAnonymous),
      }));

      return NextResponse.json({ runId, status: "queued", workflowRunId: workflowRun.runId }, { status: 202 });
    } catch (error) {
      if (runId && workerId) await releaseSearchRunLock(runId, workerId).catch(() => undefined);
      if (runId) await getDb().delete(searchRuns).where(eq(searchRuns.id, runId)).catch(() => undefined);
      if (billable) {
        await refundResearchCredit({
          userId: auth.userId,
          searchRunId: reservationRunId,
          reason: "Search run creation or scheduling failed",
        }).catch(() => undefined);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "Discovery database is unavailable." }, { status: 503 });
    }
    if (error instanceof Error && error.message.includes("Research credit account unavailable")) {
      return NextResponse.json({ error: "Research billing is temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unexpected discovery error. Please try again." }, { status: 500 });
  }
}
