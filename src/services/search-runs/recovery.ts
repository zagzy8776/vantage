/**
 * Search Run recovery worker - the durable handoff for Vercel serverless.
 *
 * The Discover endpoint persists a Search Run and returns immediately (no
 * fire-and-forget promise, which a serverless request would kill). A scheduled
 * sweep endpoint calls recoverOrphanedSearchRuns(), which resumes active runs
 * through the existing discovery engine so they always reach a terminal state.
 *
 * Idempotency / duplicate prevention:
 *  - Only active (queued/created/running) runs are claimed.
 *  - Terminal runs (completed/completed_with_errors/failed) are never resumed.
 *  - Each run is claimed atomically with a stale lock.
 *  - discoverBusinesses() is the same engine used by the original request.
 */

import { claimSearchRunForRecovery, listRecoverableSearchRuns, discoveryQueryFromSearchRun } from "./service";
import { discoverBusinesses } from "@/lib/discover/service";

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

  const candidates = await listRecoverableSearchRuns({ staleLockMs, limit: maxRuns });
  report.examined = candidates.length;

  for (const run of candidates) {
    if (isTerminalRun(run.status)) {
      report.skippedAlreadyTerminal.push(run.id);
      continue;
    }
    if (!(await claimSearchRunForRecovery(run.id, worker, staleLockMs))) continue;

    const query = discoveryQueryFromSearchRun(run);
    try {
      await discoverBusinesses(query, run.id);
      report.recovered.push(run.id);
    } catch (error) {
      report.failed.push(run.id);
      report.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  report.durationMs = Date.now() - startedAt;
  console.info(JSON.stringify({ diagnostic: "search_run_recovery", ...report }));
  return report;
}

function isTerminalRun(status: string | null): boolean {
  return status === "completed" || status === "completed_with_errors" || status === "failed";
}