/**
 * Search Run recovery coordinator for serverless deployments.
 *
 * The recovery endpoint must stay short-lived. It only claims orphaned runs
 * and starts a durable Vercel Workflow. The workflow owns the long-running
 * discovery work, so the cron request never waits on provider APIs.
 *
 * Idempotency / duplicate prevention:
 *  - Only active (queued/created/running) runs are claimed.
 *  - Terminal runs are never resumed.
 *  - Each run is claimed atomically with a stale lock.
 *  - A successful claim creates exactly one durable workflow attempt.
 *  - The workflow releases the lock on completion/failure.
 */

import { start } from "workflow/api";
import {
  claimSearchRunForRecovery,
  discoveryQueryFromSearchRun,
  listRecoverableSearchRuns,
} from "./service";
import { discoveryRecoveryWorkflow } from "@/workflows/discovery-recovery";

export const SEARCH_RUN_STALE_LOCK_MS = 10 * 60_000;

export interface SearchRunRecoveryReport {
  worker: string;
  examined: number;
  recovered: string[];
  skippedAlreadyTerminal: string[];
  failed: string[];
  errors: string[];
  startedAt: string;
  durationMs: number;
}

function newWorkerId(): string {
  return `sweep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function recoverOrphanedSearchRuns(opts: {
  workerId?: string;
  staleLockMs?: number;
  maxRuns?: number;
} = {}): Promise<SearchRunRecoveryReport> {
  const worker = opts.workerId ?? newWorkerId();
  const staleLockMs = opts.staleLockMs ?? SEARCH_RUN_STALE_LOCK_MS;
  const maxRuns = Math.max(1, Math.min(opts.maxRuns ?? 2, 10));
  const startedAt = Date.now();
  const report: SearchRunRecoveryReport = {
    worker,
    examined: 0,
    recovered: [],
    skippedAlreadyTerminal: [],
    failed: [],
    errors: [],
    startedAt: new Date(startedAt).toISOString(),
    durationMs: 0,
  };

  const candidates = await listRecoverableSearchRuns({
    staleLockMs,
    limit: maxRuns,
  });
  report.examined = candidates.length;

  for (const run of candidates) {
    if (["completed", "completed_with_errors", "failed"].includes(run.status)) {
      report.skippedAlreadyTerminal.push(run.id);
      continue;
    }

    if (!(await claimSearchRunForRecovery(run.id, worker, staleLockMs))) {
      continue;
    }

    try {
      const query = discoveryQueryFromSearchRun(run);
      const workflowRun = await start(discoveryRecoveryWorkflow, [
        query,
        run.id,
        worker,
      ]);
      report.recovered.push(run.id);
      console.info(
        JSON.stringify({
          diagnostic: "search_run_workflow_started",
          runId: run.id,
          workflowRunId: workflowRun.runId,
          worker,
        }),
      );
    } catch (error) {
      report.failed.push(run.id);
      report.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      // If workflow scheduling itself fails, leave the run recoverable. The
      // next external sweep can claim it again after the stale-lock window.
      console.error(
        JSON.stringify({
          diagnostic: "search_run_workflow_start_failed",
          runId: run.id,
          worker,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  report.durationMs = Date.now() - startedAt;
  console.info(JSON.stringify({ diagnostic: "search_run_recovery", ...report }));
  return report;
}
