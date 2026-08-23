import type { EvidenceSearchQuery, EvidenceSearchResult } from "@/services/evidence/types";
import { evidenceSearchRegistry } from "./registry";
import type { EvidenceSearchProviderId } from "./types";
import { timeoutMs, withTimeout } from "@/lib/reliability/timeout";

export type EvidenceSearchSelection = "tavily" | "exa" | "both" | "best-available";

function available(provider: EvidenceSearchProviderId) {
  return Boolean(process.env[provider === "tavily" ? "TAVILY_API_KEY" : "EXA_API_KEY"]?.trim());
}

export function getEvidenceSearchOrder(selection: EvidenceSearchSelection = "best-available"): EvidenceSearchProviderId[] {
  if (selection === "tavily") return ["tavily"];
  if (selection === "exa") return ["exa"];
  if (selection === "both") return ["tavily", "exa"];
  return ["tavily", "exa"];
}

export async function searchEvidence(query: EvidenceSearchQuery, selection: EvidenceSearchSelection = "best-available"): Promise<{ results: EvidenceSearchResult[]; providers: string[]; failures: string[]; statuses: Record<string, string>; queryCounts: Record<string, number>; successfulQueries: Record<string, number>; failedQueries: Record<string, number>; resultCounts: Record<string, number>; providerDiagnostics: Record<string, Array<Record<string, unknown>>> }> {
  const results: EvidenceSearchResult[] = [];
  const failures: string[] = [];
  const statuses: Record<string, string> = {};
  const queryCounts: Record<string, number> = {};
  const successfulQueries: Record<string, number> = {};
  const failedQueries: Record<string, number> = {};
  const resultCounts: Record<string, number> = {};
  const providerDiagnostics: Record<string, Array<Record<string, unknown>>> = {};
  for (const provider of getEvidenceSearchOrder(selection)) {
    if (!available(provider)) {
      statuses[provider] = "skipped";
      continue;
    }
    let result: EvidenceSearchResult;
    const startedAt = Date.now();
    try {
      result = await withTimeout(evidenceSearchRegistry[provider].search(query), timeoutMs("WEB_SEARCH_TIMEOUT_MS", 20_000), `${provider} web discovery`);
    } catch {
      statuses[provider] = "timeout";
      failures.push(`${provider}:timeout`);
      queryCounts[provider] = (queryCounts[provider] ?? 0) + 1;
      failedQueries[provider] = (failedQueries[provider] ?? 0) + 1;
      providerDiagnostics[provider] = [...(providerDiagnostics[provider] ?? []), { failureCategory: "timeout", safeMessage: `${provider} web discovery timed out.`, durationMs: Date.now() - startedAt }];
      continue;
    }
    queryCounts[provider] = (queryCounts[provider] ?? 0) + Math.max(result.queryCount, 1);
    statuses[provider] = result.status;
    if (result.providerDiagnostics?.length) providerDiagnostics[provider] = [...(providerDiagnostics[provider] ?? []), ...result.providerDiagnostics];
    else if (result.httpStatus || result.failureCategory || result.errorMessage) providerDiagnostics[provider] = [...(providerDiagnostics[provider] ?? []), { httpStatus: result.httpStatus, failureCategory: result.failureCategory, providerCode: result.providerCode, safeMessage: result.errorMessage, durationMs: result.durationMs }];
    if (result.status === "success" || result.status === "zero-results") {
      results.push(result);
      successfulQueries[provider] = (successfulQueries[provider] ?? 0) + result.queryCount;
      resultCounts[provider] = (resultCounts[provider] ?? 0) + result.results.length;
    } else {
      failures.push(`${provider}:${result.status}`);
      failedQueries[provider] = (failedQueries[provider] ?? 0) + result.queryCount;
    }
    if (selection === "best-available" && result.status === "success") break;
  }
  return { results, providers: results.map((result) => result.provider), failures, statuses, queryCounts, successfulQueries, failedQueries, resultCounts, providerDiagnostics };
}