import type { DiscoveryQuery } from "@/providers/business/types";

/**
 * Durable discovery execution for serverless deployments.
 *
 * The workflow itself is only orchestration. All network/database work stays
 * inside the step so Vercel can checkpoint the workflow independently of the
 * HTTP request that started it.
 */
export async function discoveryRecoveryWorkflow(
  query: DiscoveryQuery,
  runId: string,
  workerId: string,
) {
  "use workflow";

  await executeDiscoveryStep(query, runId, workerId);

  return { runId, status: "completed" as const };
}

async function executeDiscoveryStep(
  query: DiscoveryQuery,
  runId: string,
  workerId: string,
) {
  "use step";

  try {
    const { discoverBusinesses } = await import("@/lib/discover/service");
    await discoverBusinesses(query, runId);
    return { status: "completed" as const };
  } catch (error) {
    const { ensureSearchRunTerminal, releaseSearchRunLock } = await import(
      "@/services/search-runs/service"
    );

    try {
      await ensureSearchRunTerminal(runId, error);
    } finally {
      await releaseSearchRunLock(runId, workerId);
    }

    throw error;
  }
}

// Discovery providers can incur real costs. Do not replay the entire discovery
// pipeline automatically when a workflow step fails; the next external sweep
// can reclaim a stale run after the lock timeout.
executeDiscoveryStep.maxRetries = 0;
