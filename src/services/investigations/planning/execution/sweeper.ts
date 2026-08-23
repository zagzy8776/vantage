import { getExecutionWorker, SWEEP_INTERVAL_MS } from "../executor";
import { recoverOrphanedSearchRuns } from "@/services/search-runs/recovery";

let started = false;

async function sweep() {
  try {
    await getExecutionWorker().recoverActiveExecutions();
  } catch {
    // Database may not be reachable yet; the next interval retries.
  }
  try {
    // Dispatch queued/orphaned Search Runs through the discovery engine so
    // every run reaches a terminal state even when its originating request
    // was a short-lived serverless invocation.
    await recoverOrphanedSearchRuns();
  } catch {
    // The next interval retries.
  }
}

export function startExecutionSweeper() {
  if (started || typeof setInterval !== "function") return;
  if (!process.env.DATABASE_URL) return;
  started = true;
  void sweep();
  const timer = setInterval(() => { void sweep(); }, SWEEP_INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
  console.info(JSON.stringify({ diagnostic: "execution_sweeper_started", intervalMs: SWEEP_INTERVAL_MS }));
}

export function isSweeperStarted() { return started; }
