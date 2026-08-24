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

    // Ask providers for a wider candidate window. The customer-facing result is
    // reduced to unseen businesses in scopeDiscoveryResult, which makes repeat
    // scans useful instead of returning the same first page forever.
    const candidateLimit = Math.min(250, Math.max(query.limit, query.limit * 3));
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
