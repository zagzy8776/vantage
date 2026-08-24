import { NextRequest, NextResponse } from "next/server";
import { recoverOrphanedSearchRuns } from "@/services/search-runs/recovery";
import { reconcileActiveInvestigationExecutions } from "@/services/investigations/planning/executor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST/GET /api/system/sweep
 *
 * Short-lived scheduler endpoint. It authenticates the external cron caller,
 * then delegates orphaned Search Runs to the recovery coordinator. The
 * coordinator atomically claims runs and starts durable Vercel Workflows;
 * provider calls never run directly inside this HTTP request.
 */

function isAuthorized(request: NextRequest): boolean {
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
