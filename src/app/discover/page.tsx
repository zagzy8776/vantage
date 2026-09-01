"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SearchFilters } from "@/components/features/SearchFilters";
import { LeadCard } from "@/components/ui/LeadCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AccessDenied } from "@/components/app/AccessDenied";
import type { DiscoverFilters, Lead, LeadSource } from "@/lib/types";
import type { NormalizedBusiness } from "@/providers/business/types";
import { normalizedBusinessToLeadPreview } from "@/lib/discover/shared";
import { calculateInitialOpportunityScore } from "@/lib/discover/score";

type SearchRun = {
  id: string;
  query: string;
  country: string;
  city: string | null;
  depth: string;
  status: string;
  discoveredCount: number;
  enrichedCount: number;
  verifiedCount: number;
  durationMs: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  stages?: Record<string, { status?: string }>;
  result?: Record<string, unknown> | null;
};

type ResultBusiness = {
  externalId: string;
  source: "foursquare" | "yelp" | "web";
  name: string;
  category?: string;
  country?: string;
  region?: string;
  city?: string;
  area?: string;
  street?: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
};

type DiscoverSnapshot = { runId: string; results: Lead[]; savedAt: number };

const TERMINAL = ["completed", "completed_with_errors", "failed"];
const ACTIVE = ["queued", "created", "running"];
const LAST_RUN_STORAGE_KEY = "vantage:last-discover-run-id";
const DISCOVER_SNAPSHOT_KEY = "vantage:discover-results-snapshot";
const STUCK_AFTER_MS = 12 * 60_000;

function stageLabel(stages: Record<string, { status?: string }> | undefined) {
  const labels: Record<string, string> = {
    interpreting_query: "Understanding your search",
    business_discovery: "Searching businesses",
    web_discovery: "Finding websites",
    candidate_merge: "Removing duplicates",
    verification: "Checking domains",
    website_enrichment: "Reading contact pages",
    pagespeed: "Checking site quality",
    ai_analysis: "Scoring opportunities",
    finalization: "Saving results",
  };
  const active = Object.entries(stages ?? {}).find(([, value]) => value.status === "running");
  return active ? labels[active[0]] ?? active[0] : undefined;
}

function stageProgress(stages: Record<string, { status?: string }> | undefined) {
  const entries = Object.values(stages ?? {});
  if (!entries.length) return 0;
  const done = entries.filter((s) =>
    ["completed", "completed_with_errors", "skipped", "failed"].includes(s.status ?? ""),
  ).length;
  return Math.round((done / entries.length) * 100);
}

function statusMeta(status: string) {
  switch (status) {
    case "completed":
      return { label: "Completed", className: "text-success" };
    case "completed_with_errors":
      return { label: "Done · issues", className: "text-warning" };
    case "failed":
      return { label: "Failed", className: "text-danger" };
    case "running":
      return { label: "Running", className: "text-accent" };
    case "queued":
    case "created":
      return { label: "Queued", className: "text-subtle" };
    default:
      return { label: status.replaceAll("_", " "), className: "text-subtle" };
  }
}

function isStuck(run: SearchRun) {
  if (!ACTIVE.includes(run.status)) return false;
  const anchor = new Date(run.startedAt ?? run.createdAt).getTime();
  return Number.isFinite(anchor) && Date.now() - anchor > STUCK_AFTER_MS;
}

function runToLeads(run: SearchRun): Lead[] {
  const result = run.result ?? {};
  const businesses = Array.isArray(result.results) ? (result.results as ResultBusiness[]) : [];
  const storedIds = Array.isArray(result.storedIds) ? (result.storedIds as string[]) : [];
  const resultSources = Array.isArray(result.resultSources) ? (result.resultSources as string[][]) : [];
  return businesses.map((business, index) => {
    const normalized = business as NormalizedBusiness;
    const score = calculateInitialOpportunityScore(normalized);
    return normalizedBusinessToLeadPreview(
      normalized,
      storedIds[index] ?? `preview_${business.externalId}`,
      score.score,
      score.websiteStatus,
      score.reason,
      resultSources[index] as LeadSource[] | undefined,
    );
  });
}

export default function DiscoverPage() {
  const [results, setResults] = useState<Lead[]>([]);
  const [runs, setRuns] = useState<SearchRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [workflowStage, setWorkflowStage] = useState<string | null>(null);
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const [stillRunningNotice, setStillRunningNotice] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const selectedLeads = useMemo(
    () => results.filter((lead) => selectedIds.includes(lead.id) && Boolean(lead.business.website)),
    [results, selectedIds],
  );

  const activeCount = useMemo(() => runs.filter((r) => ACTIVE.includes(r.status)).length, [runs]);

  const persistSnapshot = useCallback((runId: string, leads: Lead[]) => {
    if (typeof window === "undefined" || !runId || !leads.length) return;
    try {
      window.sessionStorage.setItem(
        DISCOVER_SNAPSHOT_KEY,
        JSON.stringify({ runId, results: leads, savedAt: Date.now() } satisfies DiscoverSnapshot),
      );
    } catch {}
  }, []);

  const restoreSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.sessionStorage.getItem(DISCOVER_SNAPSHOT_KEY);
      if (!raw) return false;
      const snapshot = JSON.parse(raw) as Partial<DiscoverSnapshot>;
      if (!snapshot.runId || !Array.isArray(snapshot.results) || snapshot.results.length === 0) return false;
      if (typeof snapshot.savedAt === "number" && Date.now() - snapshot.savedAt > 24 * 60 * 60 * 1000)
        return false;
      setSelectedRunId(snapshot.runId);
      setResults(snapshot.results as Lead[]);
      setSelectedIds([]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const getSnapshotRunId = useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(DISCOVER_SNAPSHOT_KEY);
      return raw ? (JSON.parse(raw) as DiscoverSnapshot).runId : null;
    } catch {
      return null;
    }
  }, []);

  const clearRememberedRun = useCallback((clearSnapshot = true) => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(LAST_RUN_STORAGE_KEY);
      if (clearSnapshot) window.sessionStorage.removeItem(DISCOVER_SNAPSHOT_KEY);
      const url = new URL(window.location.href);
      if (url.searchParams.has("runId")) {
        url.searchParams.delete("runId");
        window.history.replaceState(window.history.state, "", url.toString());
      }
    } catch {}
  }, []);

  const rememberRun = useCallback((runId: string) => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(LAST_RUN_STORAGE_KEY, runId);
      const url = new URL(window.location.href);
      url.searchParams.set("runId", runId);
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    const response = await fetch("/api/discover/runs?limit=50", { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? "Discovery history is unavailable.");
    const history = (payload?.runs ?? []) as SearchRun[];
    setRuns(history);
    return history;
  }, []);

  const loadRun = useCallback(
    async (runId: string, options: { poll?: boolean } = {}) => {
      const poll = options.poll ?? false;
      let current: SearchRun | null = null;
      const started = Date.now();
      do {
        const response = await fetch(`/api/discover/runs/${encodeURIComponent(runId)}`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (response.status === 404) {
          setSelectedRunId(runId);
          setStillRunningNotice(false);
          setWorkflowStage(null);
          setWorkflowProgress(0);
          return null;
        }
        if (!response.ok) throw new Error(payload?.error ?? "Search run state is unavailable.");
        current = payload as SearchRun;
        setSelectedRunId(runId);
        rememberRun(runId);
        setWorkflowStage(
          stageLabel(current.stages) ??
            (TERMINAL.includes(current.status)
              ? current.status === "failed"
                ? "Failed"
                : "Complete"
              : "Waiting for research worker"),
        );
        setWorkflowProgress(stageProgress(current.stages));
        const liveResults = runToLeads(current);
        if (liveResults.length > 0) {
          setResults(liveResults);
          persistSnapshot(runId, liveResults);
          setStillRunningNotice(!TERMINAL.includes(current.status));
        }
        if (TERMINAL.includes(current.status)) break;
        if (!poll) break;
        if (Date.now() - started >= 15 * 60_000) break;
        await new Promise((resolve) => setTimeout(resolve, 2500));
      } while (true);
      if (!current) return null;
      if (current.status === "failed") {
        setError("This scan failed. Use Retry on the scan card to try again.");
      }
      const finalResults = runToLeads(current);
      setResults(finalResults);
      if (finalResults.length > 0) persistSnapshot(runId, finalResults);
      setSelectedIds([]);
      setStillRunningNotice(!TERMINAL.includes(current.status));
      setRuns((previous) => {
        const withoutCurrent = previous.filter((run) => run.id !== current!.id);
        return [current!, ...withoutCurrent].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      });
      return current;
    },
    [persistSnapshot, rememberRun],
  );

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setError(null);
    let restored = false;
    try {
      restored = restoreSnapshot();
      const history = await fetchHistory();
      const queryRunId =
        typeof window !== "undefined"
          ? new URL(window.location.href).searchParams.get("runId")
          : null;
      const storedRunId =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(LAST_RUN_STORAGE_KEY)
          : null;
      const preferredRunId = queryRunId ?? storedRunId ?? getSnapshotRunId();
      const preferredRun = preferredRunId
        ? history.find((run) => run.id === preferredRunId)
        : undefined;
      if (preferredRun) {
        const current = await loadRun(preferredRun.id, { poll: false });
        if (current && !TERMINAL.includes(current.status)) {
          setStillRunningNotice(true);
          setMessage(
            "This scan is still running on the server. Leave anytime — reopen it from Your scans.",
          );
          void loadRun(preferredRun.id, { poll: true }).catch(() => undefined);
        }
      } else if (preferredRunId && !restored) clearRememberedRun(false);
    } catch (err) {
      if (!restored) setError(err instanceof Error ? err.message : "Discovery history is unavailable.");
    } finally {
      setHistoryLoading(false);
    }
  }, [clearRememberedRun, fetchHistory, getSnapshotRunId, loadRun, restoreSnapshot]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Auto-refresh Your scans while any run is active.
  useEffect(() => {
    if (activeCount === 0) return;
    const timer = window.setInterval(() => {
      void fetchHistory().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeCount, fetchHistory]);

  const handleSearch = async (filters: DiscoverFilters) => {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    setIsForbidden(false);
    setStillRunningNotice(false);
    setResults([]);
    setSelectedIds([]);
    setWorkflowStage("Waiting for research worker");
    setWorkflowProgress(0);
    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...filters, limit: filters.maxResults }),
      });
      const initial = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 403) setIsForbidden(true);
        throw new Error(initial?.error ?? "Discovery failed.");
      }
      if (!initial?.runId) throw new Error("Discovery did not return a search run ID.");
      rememberRun(initial.runId);
      await fetchHistory().catch(() => undefined);
      const run = await loadRun(initial.runId, { poll: false });
      setIsLoading(false);
      if (run && !TERMINAL.includes(run.status)) {
        setStillRunningNotice(true);
        setMessage(
          "Research is running on the server. You can leave this page; open Your scans when you return.",
        );
        void loadRun(initial.runId, { poll: true }).catch((err) =>
          setMessage(
            err instanceof Error
              ? err.message
              : "Research is still running. Check Your scans for the latest state.",
          ),
        );
      } else if (run) {
        setMessage("New scan saved. This result is independent from your previous scans.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed.");
      setIsLoading(false);
    }
  };

  const handleSelectRun = async (runId: string) => {
    setError(null);
    setMessage(null);
    const run = await loadRun(runId, { poll: false }).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load this scan.");
      return null;
    });
    if (run && !TERMINAL.includes(run.status)) {
      setMessage("This scan is still running. Partial results appear as they are saved.");
      void loadRun(runId, { poll: true }).catch(() => undefined);
    }
  };

  const handleRetry = async (runId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setRetryingId(runId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/discover/runs/${encodeURIComponent(runId)}/retry`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Retry failed.");
      const nextId = (data?.runId as string) || runId;
      rememberRun(nextId);
      await fetchHistory().catch(() => undefined);
      setStillRunningNotice(true);
      setMessage(
        data?.mode === "new_run"
          ? "Started a new scan with the same search. Tracking progress…"
          : "Resumed this scan on the server. Tracking progress…",
      );
      void loadRun(nextId, { poll: true }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetryingId(null);
    }
  };

  const handleAnalyzeSelected = async () => {
    if (!selectedLeads.length) return;
    setBatchLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/websites/analyze/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessIds: selectedLeads.map((lead) => lead.business.id) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Website analysis failed.");
      const batch = payload?.batch;
      setMessage(`Analyzed ${batch?.successCount ?? 0}/${batch?.total ?? selectedLeads.length} selected businesses.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Website analysis failed.");
    } finally {
      setBatchLoading(false);
    }
  };

  if (isForbidden) return <AccessDenied />;
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="section-label text-accent mb-1">Research</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Discover leads
            </h1>
            <p className="text-sm text-subtle mt-1 max-w-xl">
              Pick a category and place. Every real scan is saved so you can reopen it later
              {activeCount > 0 ? (
                <span className="text-accent"> · {activeCount} still running</span>
              ) : null}
              .
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadHistory()}
            disabled={historyLoading || isLoading}
          >
            Refresh scans
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 border border-border rounded-xl bg-surface/90 p-4 sm:p-5 shadow-card">
          <SearchFilters onSearch={handleSearch} isLoading={isLoading} isDisabled={isLoading} />
        </div>

        <div className="xl:col-span-3 space-y-4">
          <section className="border border-border rounded-xl bg-surface/90 p-4 sm:p-5 shadow-card">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Your scans</h2>
                <p className="text-xs text-subtle mt-1">
                  Previous searches stay here. A new location starts a new scan.
                </p>
              </div>
              {activeCount > 0 ? (
                <span className="text-[10px] font-mono uppercase tracking-wide text-accent animate-pulse">
                  Live
                </span>
              ) : null}
            </div>

            {historyLoading ? (
              <LoadingState message="Loading saved scans..." rows={2} />
            ) : runs.length === 0 ? (
              <EmptyState
                title="No scans yet"
                description="Run your first search and VANTAGE will save the complete scan for you."
              />
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto">
                {runs.map((run) => {
                  const active = run.id === selectedRunId;
                  const location = [run.city, run.country].filter(Boolean).join(", ");
                  const meta = statusMeta(run.status);
                  const progress = stageProgress(run.stages);
                  const stage = stageLabel(run.stages);
                  const stuck = isStuck(run);
                  const showRetry = run.status === "failed" || stuck;
                  const countLabel =
                    run.discoveredCount > 0
                      ? `${run.discoveredCount} businesses`
                      : ACTIVE.includes(run.status)
                        ? "Working…"
                        : "0 businesses";

                  return (
                    <div
                      key={run.id}
                      className={`w-full text-left border rounded-xl p-3 transition-colors ${
                        active ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void handleSelectRun(run.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-sm truncate">{run.query}</span>
                          <span className={`text-[10px] uppercase font-mono shrink-0 ${meta.className}`}>
                            {meta.label}
                          </span>
                        </div>
                        <div className="text-xs text-subtle mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          <span>{location || "Any location"}</span>
                          <span>{countLabel}</span>
                          <span>{new Date(run.createdAt).toLocaleString()}</span>
                        </div>
                        {ACTIVE.includes(run.status) ? (
                          <div className="mt-2">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-subtle mb-1">
                              <span className="truncate">{stage ?? "Starting…"}</span>
                              <span className="font-mono shrink-0">{progress}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-accent transition-all duration-500"
                                style={{
                                  width: `${Math.max(progress, ACTIVE.includes(run.status) ? 6 : 0)}%`,
                                }}
                              />
                            </div>
                            {stuck ? (
                              <p className="text-[11px] text-warning mt-1.5">
                                Taking longer than usual — you can Retry if it stays stuck.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </button>
                      {showRetry ? (
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={retryingId === run.id}
                            onClick={(event) => void handleRetry(run.id, event)}
                          >
                            {retryingId === run.id ? "Retrying…" : "Retry"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {selectedRun && (
            <div className="border border-border rounded-xl bg-surface/50 p-3 text-xs text-subtle font-mono flex flex-wrap gap-x-4 gap-y-1">
              <span>Scan: {selectedRun.query}</span>
              <span>
                Location:{" "}
                {[selectedRun.city, selectedRun.country].filter(Boolean).join(", ") || "Any"}
              </span>
              <span>Businesses: {selectedRun.discoveredCount}</span>
              <span>Status: {statusMeta(selectedRun.status).label}</span>
              {workflowStage ? <span>Stage: {workflowStage}</span> : null}
              {selectedRun.durationMs != null && (
                <span>Duration: {Math.round(selectedRun.durationMs / 1000)}s</span>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              <LoadingState message={workflowStage ?? "Starting search..."} rows={5} />
            </div>
          ) : error ? (
            <div className="border border-danger/40 bg-danger/5 rounded-xl p-4 text-sm">{error}</div>
          ) : results.length === 0 ? (
            <EmptyState
              title={stillRunningNotice ? "Research is still running" : "Select a scan to view results"}
              description={
                stillRunningNotice
                  ? `${workflowStage ?? "VANTAGE is continuing the saved scan on the server."} You can leave this page and return from Your scans.${
                      workflowProgress > 0 ? ` (${workflowProgress}% complete)` : ""
                    }`
                  : "Choose one of your saved scans above, or run a new search."
              }
            />
          ) : (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Results</h2>
                  {stillRunningNotice && (
                    <p className="text-xs text-subtle mt-1">
                      Showing results already discovered while the scan continues
                      {workflowProgress > 0 ? ` · ${workflowProgress}%` : ""}.
                    </p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAnalyzeSelected}
                  disabled={!selectedLeads.length || batchLoading}
                >
                  {batchLoading
                    ? "Analyzing..."
                    : `Analyze selected (${selectedLeads.length})`}
                </Button>
              </div>
              <div className="grid gap-3">
                {results.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    selected={selectedIds.includes(lead.id)}
                    onSelect={(selected) =>
                      setSelectedIds((previous) =>
                        selected
                          ? [...previous, lead.id]
                          : previous.filter((id) => id !== lead.id),
                      )
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {message && (
            <div className="border border-info/40 bg-info/5 rounded-xl p-3 text-xs text-subtle">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
