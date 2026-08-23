import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { searchRuns } from "@/lib/db/schema";
import type { DiscoveryQuery } from "@/providers/business/types";

export type SearchRunStatus = "created" | "running" | "completed" | "completed_with_errors" | "failed";
export type SearchStageName = "interpreting_query" | "business_discovery" | "web_discovery" | "candidate_merge" | "verification" | "website_enrichment" | "pagespeed" | "ai_analysis" | "finalization";
export type SearchStageStatus = "pending" | "running" | "completed" | "completed_with_errors" | "failed" | "skipped";

export interface SearchStage {
  status: SearchStageStatus;
  startedAt?: string;
  completedAt?: string;
  count?: number;
  errorCount?: number;
  provider?: string;
  durationMs?: number;
}

export interface SearchRunFailure {
  runId: string;
  businessId?: string;
  stage: string;
  provider?: string;
  status?: number;
  errorCategory: string;
  messageCode: string;
  timestamp: string;
  retryable: boolean;
  diagnosticCode?: string;
  httpStatus?: number;
  providerCode?: string;
  safeMessage?: string;
  attemptedAt?: string;
  durationMs?: number;
}

export interface SearchRunFinalizationResult {
  attempted: boolean;
  persisted: boolean;
  verified: boolean;
  reason?: "run_not_found" | "already_terminal" | "update_zero_rows" | "update_failed" | "verification_failed";
}

const STAGES: SearchStageName[] = ["interpreting_query", "business_discovery", "web_discovery", "candidate_merge", "verification", "website_enrichment", "pagespeed", "ai_analysis", "finalization"];

function newRunId() { return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

function initialStages(): Record<string, SearchStage> {
  return Object.fromEntries(STAGES.map((stage) => [stage, { status: "pending", errorCount: 0 }])) as Record<string, SearchStage>;
}

function classifyError(error: unknown): { category: string; messageCode: string; retryable: boolean } {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("api_key") || message.includes("not configured") || message.includes("credentials")) return { category: "configuration", messageCode: "provider_not_configured", retryable: false };
  if (message.includes("401") || message.includes("403") || message.includes("authentication")) return { category: "authentication", messageCode: "provider_authentication_failed", retryable: false };
  if (message.includes("429") || message.includes("rate")) return { category: "rate_limit", messageCode: "provider_rate_limited", retryable: true };
  if (message.includes("timeout") || message.includes("aborted")) return { category: "timeout", messageCode: "provider_timeout", retryable: true };
  if (message.includes("unavailable") || message.includes("unexpected-response") || message.includes("invalid-request") || message.includes("provider_error")) return { category: "provider_error", messageCode: "provider_request_failed", retryable: true };
  if (message.includes("database") || message.includes("relation") || message.includes("column")) return { category: "database", messageCode: "database_operation_failed", retryable: true };
  if (message.includes("fetch") || message.includes("network")) return { category: "network", messageCode: "provider_network_failed", retryable: true };
  return { category: "unknown", messageCode: "stage_failed", retryable: false };
}

export function safeFailure(runId: string, stage: string, error: unknown, details?: { businessId?: string; provider?: string; status?: number; providerCode?: string; safeMessage?: string; attemptedAt?: string; durationMs?: number }): SearchRunFailure {
  const classified = classifyError(error);
  const diagnosticCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
  return { runId, businessId: details?.businessId, stage, provider: details?.provider, status: details?.status, httpStatus: details?.status, providerCode: details?.providerCode, safeMessage: details?.safeMessage, attemptedAt: details?.attemptedAt ?? new Date().toISOString(), durationMs: details?.durationMs, errorCategory: classified.category, messageCode: classified.messageCode, timestamp: new Date().toISOString(), retryable: classified.retryable, ...(diagnosticCode ? { diagnosticCode } : {}) };
}

export async function createSearchRun(query: DiscoveryQuery) {
  const id = newRunId();
  const now = new Date();
  await getDb().insert(searchRuns).values({
    id,
    query: query.category,
    country: query.country,
    city: query.city ?? null,
    depth: query.depth,
    queryExpansion: query.queryExpansion ? 1 : 0,
    evidenceEnrichment: query.evidenceEnrichment ? 1 : 0,
    searchSource: query.searchSource ?? null,
    status: "created",
    stages: initialStages(),
    failures: [],
    startedAt: now,
    createdAt: now,
  });
  return id;
}

export async function updateSearchRun(id: string, patch: Partial<typeof searchRuns.$inferInsert>) {
  return getDb().update(searchRuns).set(patch).where(eq(searchRuns.id, id)).returning({ id: searchRuns.id });
}

export async function startSearchRun(id: string) {
  await updateSearchRun(id, { status: "running", startedAt: new Date() });
}

export async function updateSearchStage(id: string, stage: SearchStageName, status: SearchStageStatus, details: Partial<SearchStage> = {}) {
  const row = (await getDb().select({ stages: searchRuns.stages }).from(searchRuns).where(eq(searchRuns.id, id)).limit(1))[0];
  const current = row?.stages ?? initialStages();
  const previous = current[stage] ?? { status: "pending" as const, errorCount: 0 };
  const now = new Date();
  const startedAt = status === "running" ? now.toISOString() : previous.startedAt;
  const completedAt = status === "running" ? undefined : now.toISOString();
  const durationMs = status === "running" || !startedAt ? undefined : Math.max(0, now.getTime() - new Date(startedAt).getTime());
  const next: SearchStage = { ...previous, ...details, status, ...(startedAt ? { startedAt } : {}), ...(completedAt ? { completedAt } : {}), ...(durationMs !== undefined ? { durationMs } : {}) };
  await updateSearchRun(id, { stages: { ...current, [stage]: next } });
  console.info(JSON.stringify({ runId: id, stage, started: status === "running", completed: status !== "running", durationMs: next.durationMs ?? null, success: status === "completed", failure: status === "failed" || status === "completed_with_errors" }));
}

export async function recordSearchFailure(failure: SearchRunFailure) {
  const row = (await getDb().select({ failures: searchRuns.failures, stages: searchRuns.stages }).from(searchRuns).where(eq(searchRuns.id, failure.runId)).limit(1))[0];
  const failures = [...(row?.failures ?? []), failure];
  const stages = row?.stages ?? initialStages();
  const current = stages[failure.stage] ?? { status: "running" as const, errorCount: 0 };
  await updateSearchRun(failure.runId, { failures: failures as Array<Record<string, unknown>>, stages: { ...stages, [failure.stage]: { ...current, errorCount: (current.errorCount ?? 0) + 1, status: "completed_with_errors" } } });
}

export async function completeSearchRun(id: string, status: Extract<SearchRunStatus, "completed" | "completed_with_errors" | "failed">, result?: Record<string, unknown>, metrics?: { providers?: string[]; requestedProvider?: string; externalSearchProviders?: string[]; providerStatuses?: Record<string, string>; webProviderDiagnostics?: Record<string, unknown[]>; firecrawlDiagnostics?: unknown[]; pageSpeedDiagnostics?: unknown[]; tavilyQueries?: number; exaQueries?: number; exaSuccessfulQueries?: number; exaFailedQueries?: number; exaResults?: number; candidatesReturned?: number; candidatesPromoted?: number; officialDomainsIdentified?: number; verificationCandidates?: number; verificationAttempted?: number; verifiedCount?: number; likelyCount?: number; uncertainCount?: number; rejectedCount?: number; firecrawlEnriched?: number; evidenceItemsGenerated?: number; discoveredCount?: number; enrichedCount?: number }) {
  const row = (await getDb().select({ startedAt: searchRuns.startedAt, status: searchRuns.status }).from(searchRuns).where(eq(searchRuns.id, id)).limit(1))[0];
  if (!row) return { attempted: false, persisted: false, verified: false, reason: "run_not_found" } satisfies SearchRunFinalizationResult;
  if (row.status === "completed" || row.status === "completed_with_errors" || row.status === "failed") return { attempted: false, persisted: true, verified: true, reason: "already_terminal" } satisfies SearchRunFinalizationResult;
  const completedAt = new Date();
  let updateResult: unknown;
  try {
    updateResult = await updateSearchRun(id, {
    status,
    providerMetrics: metrics ?? null,
    providers: metrics?.providers ?? null,
    result: result ?? null,
    externalSearchProviders: metrics?.externalSearchProviders ?? null,
    tavilyQueries: metrics?.tavilyQueries ?? 0,
    exaQueries: metrics?.exaQueries ?? 0,
    candidatesReturned: metrics?.candidatesReturned ?? 0,
    candidatesPromoted: metrics?.candidatesPromoted ?? 0,
    officialDomainsIdentified: metrics?.officialDomainsIdentified ?? 0,
    firecrawlEnriched: metrics?.firecrawlEnriched ?? 0,
    evidenceItemsGenerated: metrics?.evidenceItemsGenerated ?? 0,
    discoveredCount: metrics?.discoveredCount ?? 0,
    enrichedCount: metrics?.enrichedCount ?? 0,
    verifiedCount: metrics?.verifiedCount ?? 0,
    completedAt,
    durationMs: row?.startedAt ? Date.now() - row.startedAt.getTime() : null,
    });
  } catch {
    return { attempted: true, persisted: false, verified: false, reason: "update_failed" } satisfies SearchRunFinalizationResult;
  }
  const affectedRows = Array.isArray(updateResult) ? updateResult.length : Number((updateResult as { rowCount?: number }).rowCount ?? 0);
  if (affectedRows === 0) return { attempted: true, persisted: false, verified: false, reason: "update_zero_rows" } satisfies SearchRunFinalizationResult;
  let verifiedRow: { status: string; completedAt: Date | null } | undefined;
  try {
    verifiedRow = (await getDb().select({ status: searchRuns.status, completedAt: searchRuns.completedAt }).from(searchRuns).where(eq(searchRuns.id, id)).limit(1))[0];
  } catch {
    return { attempted: true, persisted: true, verified: false, reason: "verification_failed" } satisfies SearchRunFinalizationResult;
  }
  const verified = Boolean(verifiedRow && verifiedRow.status === status && verifiedRow.completedAt);
  return { attempted: true, persisted: true, verified, ...(verified ? {} : { reason: "verification_failed" as const }) } satisfies SearchRunFinalizationResult;
}

export async function getSearchRun(id: string) {
  return (await getDb().select().from(searchRuns).where(eq(searchRuns.id, id)).limit(1))[0] ?? null;
}

export async function ensureSearchRunTerminal(id: string, error?: unknown) {
  try {
    const run = await getSearchRun(id);
    if (!run || run.status !== "running" && run.status !== "created") return;
    const activeStage = Object.entries(run.stages ?? {}).find(([, stage]) => stage.status === "running")?.[0] as SearchStageName | undefined;
    if (activeStage) await updateSearchStage(id, activeStage, "failed");
    const failure = error ? safeFailure(id, "finalization", error, { provider: "orchestrator" }) : undefined;
    if (failure) await recordSearchFailure(failure);
    const coreDiscoveryCompleted = run.stages?.business_discovery?.status === "completed" || run.stages?.business_discovery?.status === "completed_with_errors" || run.stages?.candidate_merge?.status === "completed";
    const finalization = await completeSearchRun(id, failure && !coreDiscoveryCompleted ? "failed" : "completed_with_errors", failure ? { error: coreDiscoveryCompleted ? "Deep discovery completed with operational errors." : "Deep discovery terminated unexpectedly." } : undefined);
    if (!finalization.persisted || !finalization.verified) {
      console.error(JSON.stringify({ diagnostic: "terminal_persistence_failed", runId: id, finalization }));
    }
  } catch (terminalError) {
    console.error(JSON.stringify({ diagnostic: "terminal_persistence_failed", failure: safeFailure(id, "finalization", terminalError, { provider: "orchestrator" }) }));
  }
}

export async function getRecentSearchRuns(limit = 20) {
  return getDb().select().from(searchRuns).orderBy(desc(searchRuns.createdAt)).limit(limit);
}