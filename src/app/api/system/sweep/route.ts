import { NextRequest, NextResponse } from "next/server";
import { recoverOrphanedSearchRuns } from "@/services/search-runs/recovery";
import { reconcileActiveInvestigationExecutions } from "@/services/investigations/planning/executor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST/GET /api/system/sweep
 *
 * Durable-execution reconciliation endpoint for scheduled invocation
 * (Vercel Cron). NOT publicly callable:
 *  - Vercel Cron requests carry the platform-injected `x-vercel-cron` header,
 *  - any other caller must present `Authorization: Bearer $SWEEP_SECRET`.
 *
 * The secret never reaches the browser - it lives in server-side env only.
 *
 * Bounded work per invocation: at most SWEEP_MAX_SEARCH_RUNS orphaned Search
 * Runs are resumed and at most SWEEP_MAX_EXECUTIONS plan executions receive
 * one worker tick. Repeated invocations are idempotent.
 */

function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron")) return true;
  const secret = process.env.SWEEP_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function runSweep(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const maxRuns = Math.max(1, Math.min(Number(process.env.SWEEP_MAX_SEARCH_RUNS) || 2, 10));
  const maxExecutions = Math.max(1, Math.min(Number(process.env.SWEEP_MAX_EXECUTIONS) || 2, 10));
  const startedAt = Date.now();

  const searchRunRecovery = await recoverOrphanedSearchRuns({ maxRuns });
  const planRecovery = await reconcileActiveInvestigationExecutions(maxExecutions);

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    searchRunRecovery: {
      examined: searchRunRecovery.examined,
      recovered: searchRunRecovery.recovered,
      failed: searchRunRecovery.failed,
      errors: searchRunRecovery.errors,
    },
    planExecutionRecovery: planRecovery,
  });
}

export async function GET(request: NextRequest) {
  return runSweep(request);
}

export async function POST(request: NextRequest) {
  return runSweep(request);
}
