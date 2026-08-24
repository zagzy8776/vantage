import type { DiscoveryQuery } from "@/providers/business/types";

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

  const { ensureSearchRunTerminal, releaseSearchRunLock, updateSearchRun } = await import(
    "@/services/search-runs/service"
  );
  const { scopeDiscoveryResult } = await import("@/services/search-runs/scoping");

  try {
    const { discoverBusinesses } = await import("@/lib/discover/service");

    // Provider search APIs cap a single request at 50 results. Keep the
    // customer-facing limit while avoiding invalid provider requests.
    const candidateLimit = Math.min(50, Math.max(1, query.limit));
    const rawResult = await discoverBusinesses({ ...query, limit: candidateLimit }, runId);
    const scopedResult = await scopeDiscoveryResult(runId, query.limit, rawResult as Record<string, unknown>);

    await updateSearchRun(runId, {
      result: scopedResult as Record<string, unknown>,
      discoveredCount: scopedResult.totalUniqueResults,
    });

    return { status: "completed" as const };
  } catch (error) {
    await ensureSearchRunTerminal(runId, error);
    throw error;
  } finally {
    await releaseSearchRunLock(runId, workerId);
  }
}

executeDiscoveryStep.maxRetries = 0;
