"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { SearchFilters } from "@/components/features/SearchFilters";
import { LeadCard } from "@/components/ui/LeadCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import type { DiscoverFilters, Lead, LeadSource } from "@/lib/types";
import type { NormalizedBusiness } from "@/providers/business/types";
import { LoadingState } from "@/components/ui/LoadingState";
import { AccessDenied } from "@/components/app/AccessDenied";
import { normalizedBusinessToLeadPreview } from "@/lib/discover/shared";
import { calculateInitialOpportunityScore } from "@/lib/discover/score";

const WORKFLOW_STAGES = ["Interpreting query", "Searching businesses", "Discovering websites", "Collecting evidence", "PageSpeed", "Analyzing opportunities", "Complete"];

const stageLabel = (stages: Record<string, { status?: string }> | undefined) => {
  const labels: Record<string, string> = { interpreting_query: "Interpreting query", business_discovery: "Searching businesses", web_discovery: "Discovering websites", candidate_merge: "Deduplicating", verification: "Verifying domains", website_enrichment: "Collecting evidence", pagespeed: "PageSpeed", ai_analysis: "Analyzing opportunities", finalization: "Complete" };
  const active = Object.entries(stages ?? {}).find(([, stage]) => stage.status === "running");
  return active ? labels[active[0]] ?? active[0] : undefined;
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

export default function DiscoverPage() {
  const [results, setResults] = useState<Lead[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [providerMeta, setProviderMeta] = useState<Record<string, { status: string; count: number; queried: boolean }>>({});
  const [totalUniqueResults, setTotalUniqueResults] = useState(0);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [workflowStage, setWorkflowStage] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [stillRunningNotice, setStillRunningNotice] = useState(false);
  const [showCreateInvestigation, setShowCreateInvestigation] = useState(false);
  const [investigationTitle, setInvestigationTitle] = useState("");
  const [investigationObjective, setInvestigationObjective] = useState("");
  const [investigationType, setInvestigationType] = useState<"company" | "industry" | "market" | "problem" | "service_opportunity" | "custom">("industry");
  const [problemCategory, setProblemCategory] = useState("appointment_no_shows");
  const [serviceCategory, setServiceCategory] = useState("");
  const [objectiveIndustry, setObjectiveIndustry] = useState("");
  const [objectiveLocation, setObjectiveLocation] = useState("");
  const [objectiveQuestion, setObjectiveQuestion] = useState("");
  const [createInvestigationLoading, setCreateInvestigationLoading] = useState(false);
  const [createInvestigationError, setCreateInvestigationError] = useState<string | null>(null);

  const selectedLeads = useMemo(() => results.filter((lead) => selectedIds.includes(lead.id) && Boolean(lead.business.website)), [results, selectedIds]);

  const handleSearch = async (filters: DiscoverFilters) => {
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);
    setHasSearched(true);
    setStillRunningNotice(false);
    setWorkflowStage("Queued for research worker");

    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...filters, limit: filters.maxResults }),
      });

      const initial = await response.json().catch(() => null);

      if (!response.ok) {
        // 403 = authenticated but not allowed - never a login problem
        if (response.status === 403) setIsForbidden(true);
        throw new Error(initial?.error ?? "Discovery failed.");
      }

      const runId = initial?.runId;
      if (!runId) throw new Error("Discovery did not return a search run ID.");
      setLastRunId(runId);

      // Durable execution: the run is queued server-side and processed by the
      // sweep worker (Vercel Cron / in-process sweeper). Poll with a sane
      // interval; after a short grace period tell the user they can leave.
      const POLL_INTERVAL_MS = 2500;
      const STILL_RUNNING_AFTER_MS = 25_000;
      const MAX_POLL_MS = 15 * 60_000;

      let payload: Record<string, unknown> & { results?: unknown[]; resultSources?: string[][]; providers?: Record<string, { status: string; count: number; queried: boolean }>; totalUniqueResults?: number; fallbackUsed?: boolean; workflow?: { stage?: string }; storedIds?: string[] } | null = null;
      const pollStartedAt = Date.now();
      while (Date.now() - pollStartedAt < MAX_POLL_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const stateResponse = await fetch(`/api/discover/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
        const state = await stateResponse.json().catch(() => null);
        if (!stateResponse.ok) throw new Error(state?.error ?? "Search run state is unavailable.");

        if (state?.status === "queued" || state?.status === "created") {
          setWorkflowStage("Queued for research worker");
        } else {
          const stage = stageLabel(state?.stages);
          if (stage) setWorkflowStage(stage);
        }

        if (Date.now() - pollStartedAt > STILL_RUNNING_AFTER_MS) {
          setStillRunningNotice(true);
        }

        if (["completed", "completed_with_errors", "failed"].includes(state?.status)) {
          if (state.status === "failed") throw new Error("Deep discovery failed. Inspect the search run diagnostics.");
          payload = state.result;
          break;
        }
      }

      if (!payload) {
        // Research legitimately takes minutes. Stop spinning - the sweep
        // worker keeps processing server-side and the Search Run page always
        // reflects the latest state.
        setStillRunningNotice(true);
        setIsLoading(false);
        return;
      }
      setStillRunningNotice(false);

      const nextResults: Lead[] = (payload?.results as ResultBusiness[] | undefined ?? []).map((business, index) => {
        const normalizedBusiness = business as NormalizedBusiness;
        const score = calculateInitialOpportunityScore(normalizedBusiness);
        return normalizedBusinessToLeadPreview(
          normalizedBusiness,
          payload?.storedIds?.[index] ?? `preview_${business.externalId}`,
          score.score,
          score.websiteStatus,
          score.reason,
          payload?.resultSources?.[index] as LeadSource[] | undefined,
        );
      });

      setSources((payload?.resultSources ?? []).map((sourceList: string[]) => sourceList.join(" + ")));
      setProviderMeta(payload?.providers ?? {});
      setTotalUniqueResults(payload?.totalUniqueResults ?? nextResults.length);
      setFallbackUsed(Boolean(payload?.fallbackUsed));
      setResults(nextResults);
      setWorkflowStage(payload?.workflow?.stage ?? "Complete");
    } catch (err) {
            setResults([]);
      setSources([]);
      setProviderMeta({});
      setTotalUniqueResults(0);
      setFallbackUsed(false);
      setError(err instanceof Error ? err.message : "Discovery failed.");
      setWorkflowStage(null);
      setStillRunningNotice(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeLead = async (lead: Lead) => {
    setBatchLoading(true);
    setBatchMessage(null);
    try {
      const response = await fetch("/api/websites/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: lead.business.id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Website analysis failed.");
      setBatchMessage(`Analyzed ${lead.business.name}.`);
    } catch (err) {
      setBatchMessage(err instanceof Error ? err.message : "Website analysis failed.");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleAnalyzeSelected = async () => {
    if (!selectedLeads.length) return;
    setBatchLoading(true);
    setBatchMessage(null);
    try {
      const response = await fetch("/api/websites/analyze/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessIds: selectedLeads.map((lead) => lead.business.id) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Batch analysis failed.");
      const batch = payload?.batch;
      setBatchMessage(`Analyzed ${batch?.successCount ?? 0}/${batch?.total ?? selectedLeads.length} selected leads.`);
    } catch (err) {
      setBatchMessage(err instanceof Error ? err.message : "Batch analysis failed.");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleCreateInvestigation = async () => {
    if (!lastRunId) return;
    setCreateInvestigationLoading(true);
    setCreateInvestigationError(null);
    try {
      const response = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: investigationTitle.trim() || `Investigation for ${investigationType}`,
          objective: investigationObjective.trim() || `Investigate businesses discovered in the ${investigationType} deep search.`,
          investigationType: investigationType === "custom" ? "problem" : investigationType,
          criteria: {
            ...(investigationType === "custom" ? { objectiveMode: "custom" } : {}),
            ...(investigationType === "problem" ? { problemCategory, targetIndustry: objectiveIndustry, additionalQuestion: objectiveQuestion, location: objectiveLocation } : {}),
            ...(investigationType === "service_opportunity" ? { serviceCategory, targetIndustry: objectiveIndustry, idealCustomerCriteria: objectiveQuestion, location: objectiveLocation } : {}),
          },
          searchRunId: lastRunId,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Failed to create investigation.");
      setShowCreateInvestigation(false);
      setInvestigationTitle("");
      setInvestigationObjective("");
      setInvestigationType("industry");
      setProblemCategory("appointment_no_shows");
      setServiceCategory("");
      setObjectiveIndustry("");
      setObjectiveLocation("");
      setObjectiveQuestion("");
      setBatchMessage(`Investigation created: ${payload.investigationId}`);
    } catch (err) {
      setCreateInvestigationError(err instanceof Error ? err.message : "Failed to create investigation.");
    } finally {
      setCreateInvestigationLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-extrabold font-mono">Discover</h1>
          <p className="text-sm text-subtle">Search business categories and international geography across provider-neutral discovery sources.</p>
          {results.length > 0 && (
            <div className="text-xs text-subtle font-mono space-y-1">
              <div>Sources: {sources.length ? sources.join(" | ") : "Unknown"}</div>
              <div>Total unique results: {totalUniqueResults}</div>
              {fallbackUsed && <div>Fallback used: Yes</div>}
              {workflowStage && <div className="pt-1 flex flex-wrap gap-1">{WORKFLOW_STAGES.map((stage) => <span key={stage} className={`px-1.5 py-0.5 rounded border ${stage === workflowStage ? "border-accent text-accent" : WORKFLOW_STAGES.indexOf(stage) < WORKFLOW_STAGES.indexOf(workflowStage) ? "border-success/30 text-success" : "border-border text-subtle"}`}>{stage}</span>)}</div>}
            </div>
          )}
        </section>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-2 border border-border rounded-lg bg-surface p-4">
            <SearchFilters onSearch={handleSearch} isLoading={isLoading} isDisabled={isLoading} />
          </div>
          <div className="xl:col-span-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold uppercase font-mono">Live Results</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="secondary" size="sm" onClick={handleAnalyzeSelected} isLoading={batchLoading} disabled={!selectedLeads.length}>
                  Analyze Selected ({selectedLeads.length})
                </Button>
                {lastRunId && (
                  <Button variant="secondary" size="sm" onClick={() => { setInvestigationTitle(`Investigation: ${results[0]?.business?.category ?? "Market"}`); setInvestigationObjective(`Investigate businesses discovered in the ${investigationType} deep search.`); setShowCreateInvestigation(true); }} disabled={isLoading || createInvestigationLoading}>
                    Create Investigation
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => { setResults([]); setError(null); setHasSearched(false); setSelectedIds([]); setBatchMessage(null); setLastRunId(null); }}>
                  Reset
                </Button>
              </div>
            </div>
            {batchMessage && <div className="text-xs text-subtle font-mono">{batchMessage}</div>}
            {Object.keys(providerMeta).length > 0 && (
              <div className="border border-border rounded-lg bg-surface/40 p-3 text-xs font-mono text-subtle space-y-1">
                {Object.entries(providerMeta).map(([provider, meta]) => (
                  <div key={provider} className="flex items-center justify-between gap-3">
                    <span className="uppercase">{provider}</span>
                    <span>{meta.status} · {meta.count}</span>
                  </div>
                ))}
              </div>
            )}
            {isLoading ? (
              <div className="space-y-3">
                <LoadingState message={workflowStage ?? "Searching configured discovery providers and storing opportunities..."} rows={4} />
                {stillRunningNotice && (
                  <div className="border border-info/40 bg-info/5 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Research is still running. You can leave this page — VANTAGE will continue processing it.</p>
                    <p className="text-xs text-subtle">Deep discovery typically takes a few minutes. Results land on the Search Run page as providers report back.</p>
                    {lastRunId && (
                      <Link href={`/discover/runs/${encodeURIComponent(lastRunId)}`} className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-mono">
                        View Search Run →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ) : stillRunningNotice && !error ? (
              <div className="border border-info/40 bg-info/5 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">Research is still running. You can leave this page — VANTAGE will continue processing it.</p>
                <p className="text-xs text-subtle">This deep search takes several minutes. The Search Run page always shows the latest state.</p>
                {lastRunId && (
                  <Link href={`/discover/runs/${encodeURIComponent(lastRunId)}`} className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-mono">
                    View Search Run →
                  </Link>
                )}
              </div>
            ) : error ? (
              isForbidden ? (
                <AccessDenied
                  title="Discovery restricted"
                  description="Your account does not have permission to run discovery. Discovery triggers paid provider calls and requires analyst access or higher."
                />
              ) : (
                <EmptyState title="Discovery unavailable" description={error} />
              )
            ) : results.length ? (
              <div className="grid grid-cols-1 gap-3">
                {results.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    selected={selectedIds.includes(lead.id)}
                    onSelectedChange={(selected) => setSelectedIds((current) => selected ? (current.includes(lead.id) ? current : [...current, lead.id]) : current.filter((id) => id !== lead.id))}
                    onAnalyzeWebsite={lead.business.website ? () => handleAnalyzeLead(lead) : undefined}
                  />
                ))}
              </div>
            ) : hasSearched ? (
              <EmptyState title="No opportunities found" description="Try a broader category or a different location." />
            ) : (
              <EmptyState title="Ready to search" description="Choose a category and country, then find opportunities." />
            )}
          </div>
        </div>
      </div>
      <Dialog open={showCreateInvestigation} onClose={() => setShowCreateInvestigation(false)} title="Create Investigation" description="Create a persistent investigation workspace from this search run.">
        <div className="space-y-4">
          <Input label="Title" value={investigationTitle} onChange={(e) => setInvestigationTitle(e.target.value)} placeholder="e.g., Toronto Beauty Market Investigation" />
          <Textarea label="Objective" value={investigationObjective} onChange={(e) => setInvestigationObjective(e.target.value)} placeholder="e.g., Investigate commercially meaningful operational and digital opportunities among beauty businesses in Toronto." rows={3} />
          <Select
            label="Investigation Type"
            value={investigationType}
            onChange={(e) => setInvestigationType(e.target.value as typeof investigationType)}
            options={[
              { value: "company", label: "Company" },
              { value: "industry", label: "Industry" },
              { value: "market", label: "Market" },
              { value: "problem", label: "Problem" },
              { value: "service_opportunity", label: "Service Opportunity" },
              { value: "custom", label: "Custom" },
            ]}
          />
          {investigationType === "problem" && <>
            <Select label="Problem" value={problemCategory} onChange={(e) => setProblemCategory(e.target.value)} options={[{ value: "appointment_no_shows", label: "Appointment no-shows" }, { value: "missed_followups", label: "Missed follow-ups" }, { value: "order_management", label: "Order management" }, { value: "inventory_discrepancy", label: "Inventory discrepancy" }, { value: "payment_collection", label: "Payment collection" }, { value: "manual_reconciliation", label: "Manual reconciliation" }, { value: "customer_retention", label: "Customer retention" }, { value: "workflow_fragmentation", label: "Workflow fragmentation" }, { value: "reporting_visibility", label: "Reporting visibility" }]} />
            <Input label="Industry" value={objectiveIndustry} onChange={(e) => setObjectiveIndustry(e.target.value)} placeholder="Beauty" />
            <Input label="Location" value={objectiveLocation} onChange={(e) => setObjectiveLocation(e.target.value)} placeholder="Toronto, Canada" />
            <Textarea label="Additional question" value={objectiveQuestion} onChange={(e) => setObjectiveQuestion(e.target.value)} placeholder="What evidence would suggest this problem exists?" rows={2} />
          </>}
          {investigationType === "service_opportunity" && <>
            <Input label="What service/software opportunity?" value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)} placeholder="Inventory management" />
            <Input label="Industry" value={objectiveIndustry} onChange={(e) => setObjectiveIndustry(e.target.value)} placeholder="Restaurants" />
            <Input label="Location" value={objectiveLocation} onChange={(e) => setObjectiveLocation(e.target.value)} placeholder="Lagos, Nigeria" />
            <Textarea label="Ideal customer characteristics" value={objectiveQuestion} onChange={(e) => setObjectiveQuestion(e.target.value)} placeholder="Multi-location businesses" rows={2} />
          </>}
          {createInvestigationError && <div className="text-sm text-error">{createInvestigationError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateInvestigation(false)} disabled={createInvestigationLoading}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvestigation} isLoading={createInvestigationLoading}>
              Create Investigation
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}