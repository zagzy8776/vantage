"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate, formatDomain } from "@/lib/utils";
import { Tabs } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { FindingDrawer } from "./FindingDrawer";
import { InvestigationContradictions } from "./InvestigationContradictions";
import { InvestigationUnknowns } from "./InvestigationUnknowns";
import { InvestigationSearchRuns } from "./InvestigationSearchRuns";
import { ResearchPlanPanel } from "./ResearchPlanPanel";
import type {
  InvestigationDetail,
  InvestigationBusinessSummary,
  InvestigationEvidenceItem,
} from "@/services/investigations/types";
import { PROBLEM_LABELS } from "@/services/investigations/opportunity/objectives";

const TYPE_LABELS: Record<string, string> = {
  company: "Company investigation",
  industry: "Industry investigation",
  market: "Market investigation",
  problem: "Problem investigation",
  service_opportunity: "Service opportunity investigation",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-subtle/10 text-subtle border-subtle/30",
  active: "bg-info/10 text-info border-info/30",
  completed: "bg-success/10 text-success border-success/30",
  archived: "bg-muted/10 text-muted border-muted/30",
};

const FINDING_TYPE_STYLES: Record<string, string> = {
  market_pattern: "bg-accent/10 text-accent border-accent/30",
  business_pattern: "bg-info/10 text-info border-info/30",
  operational_signal: "bg-warning/10 text-warning border-warning/30",
  digital_signal: "bg-score-high/10 text-score-high border-score-high/30",
  opportunity_signal: "bg-success/10 text-success border-success/30",
  risk: "bg-danger/10 text-danger border-danger/30",
};

const OPPORTUNITY_STATUS_STYLES: Record<string, string> = {
  hypothesis: "bg-subtle/10 text-subtle border-subtle/40",
  needs_validation: "bg-warning/10 text-warning border-warning/30",
  supported: "bg-success/10 text-success border-success/30",
  rejected: "bg-danger/10 text-danger border-danger/30",
};

const ACTION_STATUS_STYLES: Record<string, string> = {
  todo: "bg-subtle/10 text-subtle border-subtle/30",
  in_progress: "bg-info/10 text-info border-info/30",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-muted/10 text-muted border-muted/30",
};

const VERIFICATION_STYLES: Record<string, string> = {
  verified: "bg-success/10 text-success border-success/30",
  likely: "bg-info/10 text-info border-info/30",
  uncertain: "bg-warning/10 text-warning border-warning/30",
  rejected: "bg-danger/10 text-danger border-danger/30",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-success/10 text-success border-success/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  low: "bg-surface-2 text-subtle border-border",
};

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wide whitespace-nowrap select-none", className)}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] uppercase font-mono text-subtle tracking-wider mb-2">{children}</h4>;
}

function MetricTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="border border-border rounded-lg bg-surface px-3 py-2.5 min-w-[104px] flex-1">
      <div className={cn("text-lg font-mono font-bold leading-none", tone ?? "text-foreground")}>{value}</div>
      <div className="text-[10px] uppercase font-mono text-subtle mt-1 tracking-wide whitespace-nowrap">{label}</div>
    </div>
  );
}

export function InvestigationRoom({ id }: { id: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<InvestigationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [openFindingId, setOpenFindingId] = useState<string | null>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editObjective, setEditObjective] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [businessBusyId, setBusinessBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [evidenceSource, setEvidenceSource] = useState("all");
  const [evidenceCategory, setEvidenceCategory] = useState("all");
  const [evidenceConfidence, setEvidenceConfidence] = useState("all");
  const [evidenceBusiness, setEvidenceBusiness] = useState("all");
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isMarketSynthesizing, setIsMarketSynthesizing] = useState(false);

  const fetchDetail = useCallback(async (includeEvidence = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/investigations/${encodeURIComponent(id)}${includeEvidence ? "?includeEvidence=true" : ""}`, { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Investigation is unavailable.");
      setDetail(payload as InvestigationDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Investigation is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchDetail();
  }, [fetchDetail]);

  const businessNameById = useMemo(() => {
    const map = new Map<string, string>();
    detail?.businessDetails.forEach((b) => map.set(b.businessId, b.name));
    return map;
  }, [detail]);

  const evidenceSources = useMemo(
    () => Array.from(new Set((detail?.evidenceItems ?? []).map((item) => item.sourceType))).sort(),
    [detail]
  );
  const evidenceCategories = useMemo(
    () => Array.from(new Set((detail?.evidenceItems ?? []).map((item) => item.category))).sort(),
    [detail]
  );

  const filteredEvidence = useMemo(() => {
    return (detail?.evidenceItems ?? []).filter((item) => {
      if (evidenceSource !== "all" && item.sourceType !== evidenceSource) return false;
      if (evidenceCategory !== "all" && item.category !== evidenceCategory) return false;
      if (evidenceConfidence !== "all" && item.confidence !== evidenceConfidence) return false;
      if (evidenceBusiness !== "all" && item.businessId !== evidenceBusiness) return false;
      return true;
    });
  }, [detail, evidenceSource, evidenceCategory, evidenceConfidence, evidenceBusiness]);

  const openFinding = detail?.findings.find((f) => f.id === openFindingId) ?? null;

  const latestSynthesis = detail?.syntheses?.[0] ?? null;
  const latestMarketSynthesis = detail?.marketSyntheses?.[0] ?? null;
  const latestOpportunitySynthesis = detail?.opportunitySyntheses?.[0] ?? null;
  const isOpportunityInvestigation = detail?.investigationType === "problem" || detail?.investigationType === "service_opportunity";
  const opportunityLabel = detail?.investigationType === "problem" ? "Problem Signals" : detail?.investigationType === "service_opportunity" ? "Opportunity Hypotheses" : "Opportunities";

  const handleEditOpen = () => {
    if (!detail) return;
    setEditTitle(detail.title);
    setEditObjective(detail.objective);
    setMutationError(null);
    setShowEdit(true);
  };

  const handleEditSave = async () => {
    setIsSavingEdit(true);
    setMutationError(null);
    try {
      const res = await fetch(`/api/investigations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, objective: editObjective }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to update investigation.");
      setShowEdit(false);
      await fetchDetail();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to update investigation.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    setMutationError(null);
    try {
      const res = await fetch(`/api/investigations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to archive investigation.");
      setShowArchive(false);
      router.push("/investigations");
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to archive investigation.");
      setShowArchive(false);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleActionStatus = async (actionId: string, status: string) => {
    setActionBusyId(actionId);
    setMutationError(null);
    try {
      const res = await fetch(`/api/investigations/${encodeURIComponent(id)}/actions/${encodeURIComponent(actionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to update action.");
      await fetchDetail();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to update action.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setIsSavingNote(true);
    setMutationError(null);
    try {
      const res = await fetch(`/api/investigations/${encodeURIComponent(id)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent, author: "Lead Engineer" }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to create note.");
      setNoteContent("");
      await fetchDetail();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to create note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(id)}/synthesize`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Investigation synthesis failed.");
      await fetchDetail(false);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Investigation synthesis failed.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleMarketSynthesize = async () => {
    setIsMarketSynthesizing(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(id)}/market-synthesis`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Market synthesis failed.");
      await fetchDetail(false);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Market synthesis failed.");
    } finally {
      setIsMarketSynthesizing(false);
    }
  };

  const handleOpportunitySynthesize = async () => {
    setIsMarketSynthesizing(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/investigations/${encodeURIComponent(id)}/opportunity-synthesis`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Opportunity investigation failed.");
      await fetchDetail(false);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Opportunity investigation failed.");
    } finally {
      setIsMarketSynthesizing(false);
    }
  };

  const handleBusinessRole = async (businessId: string, role: string) => {
    setBusinessBusyId(businessId);
    setMutationError(null);
    try {
      const res = await fetch(`/api/investigations/${encodeURIComponent(id)}/businesses/${encodeURIComponent(businessId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to review business relationship.");
      await fetchDetail();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to review business relationship.");
    } finally {
      setBusinessBusyId(null);
    }
  };

  const handleRemoveBusiness = async (businessId: string, businessName: string) => {
    if (!window.confirm(`Remove ${businessName} from this investigation? The Business record will not be deleted.`)) return;
    setBusinessBusyId(businessId);
    setMutationError(null);
    try {
      const res = await fetch(`/api/investigations/${encodeURIComponent(id)}/businesses/${encodeURIComponent(businessId)}`, { method: "DELETE" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to remove business.");
      await fetchDetail();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to remove business.");
    } finally {
      setBusinessBusyId(null);
    }
  };

  const viewEvidenceForBusiness = (businessId: string) => {
    setEvidenceBusiness(businessId);
    setActiveTab("evidence");
    if (detail?.metrics.evidence && detail.evidenceItems.length === 0) void fetchDetail(true);
  };

  const viewEvidenceItem = (evidenceId: string) => {
    setExpandedEvidenceId(evidenceId);
    setActiveTab("evidence");
    if (detail?.metrics.evidence && detail.evidenceItems.length === 0) void fetchDetail(true);
    window.setTimeout(() => document.getElementById(`evidence-${evidenceId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };

  const viewBusiness = (businessId: string) => {
    setActiveTab("businesses");
    window.setTimeout(() => document.getElementById(`business-row-${businessId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "evidence" && detail?.metrics.evidence && detail.evidenceItems.length === 0) void fetchDetail(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="animate-pulse"><div className="h-6 bg-surface-2 rounded w-1/3 mb-3" /><div className="h-3 bg-surface-2 rounded w-2/3" /></Card>
        <div className="flex gap-3 flex-wrap">{[...Array(5)].map((_, i) => <div key={i} className="h-16 w-28 bg-surface-2 rounded-lg animate-pulse" />)}</div>
        <Card className="animate-pulse"><div className="h-40 bg-surface-2 rounded" /></Card>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <EmptyState title="Investigation unavailable" description={error ?? "Investigation not found."} />
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => fetchDetail()}>Retry</Button>
        </div>
      </div>
    );
  }

  const geography = [detail.city, detail.region, detail.country].filter(Boolean).join(", ") || "Not specified";
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "research-plan", label: "Research Plan" },
    { id: "market-intelligence", label: "Market Intelligence", count: latestMarketSynthesis?.patterns.length ?? 0 },
    { id: "findings", label: isOpportunityInvestigation ? opportunityLabel : "Findings", count: detail.metrics.findings },
    { id: "businesses", label: "Businesses", count: detail.metrics.businesses },
    { id: "evidence", label: "Evidence", count: detail.metrics.evidence },
    { id: "opportunities", label: isOpportunityInvestigation ? "Opportunity Hypotheses" : "Opportunities", count: detail.metrics.opportunities },
    { id: "contradictions", label: "Contradictions", count: detail.metrics.contradictions },
    { id: "unknowns", label: "Unknowns", count: detail.metrics.unknowns },
    { id: "actions", label: "Actions", count: detail.actions.length },
    { id: "notes", label: "Notes", count: detail.notes.length },
    { id: "search-runs", label: "Search Runs", count: detail.metrics.searchRuns },
  ];

  return (
    <div className="space-y-5">
      {/* ===== Header ===== */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={STATUS_STYLES[detail.status] ?? "bg-surface-2 text-subtle border-border"}>{detail.status}</Badge>
              <span className="text-[11px] font-mono text-subtle uppercase tracking-wide">{TYPE_LABELS[detail.investigationType] ?? detail.investigationType}</span>
            </div>
            <h1 className="text-xl font-extrabold font-mono text-foreground leading-tight break-words">{detail.title}</h1>
            <p className="text-sm text-muted leading-6">{detail.objective}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-subtle pt-1">
              <span>Industry: {detail.industry ?? "Not specified"}</span>
              <span>Geography: {geography}</span>
              <span>Created {formatDate(typeof detail.createdAt === "string" ? detail.createdAt : detail.createdAt.toISOString())}</span>
              <span>Updated {formatDate(typeof detail.updatedAt === "string" ? detail.updatedAt : detail.updatedAt.toISOString())}</span>
              <span>{detail.metrics.searchRuns} source {detail.metrics.searchRuns === 1 ? "run" : "runs"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button variant="secondary" size="sm" onClick={handleEditOpen}>Edit</Button>
            <Button variant="secondary" size="sm" onClick={() => fetchDetail()}>Refresh data</Button>
            <Button variant="danger" size="sm" onClick={() => setShowArchive(true)} disabled={detail.status === "archived"}>Archive</Button>
          </div>
        </div>
      </Card>

      {mutationError && (
        <div className="border border-danger/40 bg-danger/5 rounded-md px-4 py-2.5 text-sm text-danger">{mutationError}</div>
      )}

      {/* ===== Metrics ===== */}
      <div className="flex gap-3 flex-wrap">
        <MetricTile label="Businesses" value={detail.metrics.businesses} />
        <MetricTile label="Search Runs" value={detail.metrics.searchRuns} />
        <MetricTile label="Sources" value={detail.metrics.sources} />
        <MetricTile label="Evidence" value={detail.metrics.evidence} />
        <MetricTile label="Supported Claims" value={detail.metrics.supportedClaims} tone="text-success" />
        <MetricTile label="Findings" value={detail.metrics.findings} />
        <MetricTile label="Opportunities" value={detail.metrics.opportunities} />
        <MetricTile label="Unknowns" value={detail.metrics.unknowns} tone="text-info" />
        <MetricTile label="Contradictions" value={detail.metrics.contradictions} tone={detail.metrics.contradictions > 0 ? "text-warning" : undefined} />
      </div>

      {/* ===== Tabs ===== */}
      <Tabs tabs={tabs} activeId={activeTab} onChange={handleTabChange} />

      {/* ===== Overview ===== */}
      {activeTab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Executive summary" subtitle={latestSynthesis ? `${latestSynthesis.provider}${latestSynthesis.model ? ` · ${latestSynthesis.model}` : ""} · ${latestSynthesis.validationStatus.replace(/_/g, " ")}` : "Evidence-backed synthesis"} headerAction={<Button size="sm" variant="secondary" onClick={handleSynthesize} isLoading={isSynthesizing}>Generate synthesis</Button>}>
            {latestSynthesis?.executiveSummary ? (
              <>
                <div className={cn("mb-3 rounded-md border px-3 py-2 text-[10px] font-mono uppercase", latestSynthesis.validationStatus === "supported" ? "border-success/30 bg-success/5 text-success" : "border-warning/30 bg-warning/5 text-warning")}>Trust status: {latestSynthesis.validationStatus.replace(/_/g, " ")}</div>
                <p className="text-sm text-muted leading-6">{latestSynthesis.executiveSummary}</p>
              </>
            ) : (
              <div className="space-y-3"><p className="text-sm text-subtle">No synthesis has been generated yet.</p><p className="text-xs text-subtle">VANTAGE will compute database-backed aggregates first, then ask the configured AI router to interpret only supplied evidence.</p></div>
            )}
          </Card>
          {detail.syntheses && detail.syntheses.length > 0 && (
            <Card title="Previous syntheses" subtitle="Historical results are append-only.">
              <div className="space-y-2">
                {detail.syntheses.map((synthesis) => (
                  <div key={synthesis.id} className="flex items-center gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                    <span className="text-[10px] text-subtle font-mono">{formatDate(String(synthesis.createdAt))}</span>
                    <span className="text-xs text-muted truncate">{synthesis.provider}{synthesis.model ? ` · ${synthesis.model}` : ""}</span>
                    <Badge className={synthesis.validationStatus === "supported" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"}>{synthesis.status.replace(/_/g, " ")} · {synthesis.validationStatus.replace(/_/g, " ")}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card title="Scope">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-[10px] uppercase font-mono text-subtle mb-0.5">Industry</dt><dd className="text-muted">{detail.industry ?? "—"}</dd></div>
              <div><dt className="text-[10px] uppercase font-mono text-subtle mb-0.5">Country</dt><dd className="text-muted">{detail.country ?? "—"}</dd></div>
              <div><dt className="text-[10px] uppercase font-mono text-subtle mb-0.5">Region</dt><dd className="text-muted">{detail.region ?? "—"}</dd></div>
              <div><dt className="text-[10px] uppercase font-mono text-subtle mb-0.5">City</dt><dd className="text-muted">{detail.city ?? "—"}</dd></div>
            </dl>
            {detail.criteria && Object.keys(detail.criteria).length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <SectionLabel>Criteria</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(detail.criteria).map(([key, value]) => (
                    <span key={key} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-surface-2 text-muted">{key}: {String(value)}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="Investigation health">
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted">Businesses researched</span><span className="font-mono">{detail.metrics.businesses}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted">Evidence volume</span><span className="font-mono">{detail.metrics.evidence}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted">Verification state</span><span className="font-mono text-subtle text-xs">{detail.metrics.businesses > 0 ? "mixed — see Businesses" : "not started"}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted">Supported claims</span><span className="font-mono text-success">{detail.metrics.supportedClaims}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted">Unresolved contradictions</span><span className={cn("font-mono", detail.metrics.contradictions > 0 ? "text-warning" : "")}>{detail.metrics.contradictions}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted">Open unknowns</span><span className="font-mono text-info">{detail.metrics.unknowns}</span></div>
            </div>
          </Card>

          <Card title="Recent activity">
            <div className="space-y-3">
              <div>
                <SectionLabel>Latest search run</SectionLabel>
                {detail.runDetails.length === 0 ? (
                  <p className="text-xs text-subtle">No search runs attached.</p>
                ) : (
                  <div className="border border-border rounded-md px-3 py-2 text-xs">
                    <span className="text-foreground font-medium">{detail.runDetails[0].query}</span>
                    <span className="text-subtle font-mono ml-2">{detail.runDetails[0].status}</span>
                    <div className="text-subtle mt-0.5">{formatDate(typeof detail.runDetails[0].attachedAt === "string" ? detail.runDetails[0].attachedAt : detail.runDetails[0].attachedAt.toISOString())}</div>
                  </div>
                )}
              </div>
              <div>
                <SectionLabel>Latest evidence</SectionLabel>
                {detail.evidenceItems.length === 0 ? (
                  <p className="text-xs text-subtle">No evidence available.</p>
                ) : (
                  (() => {
                    const latest = [...detail.evidenceItems].sort((a, b) => new Date(String(b.observedAt)).getTime() - new Date(String(a.observedAt)).getTime())[0];
                    return (
                      <div className="border border-border rounded-md px-3 py-2 text-xs">
                        <p className="text-muted leading-5">{latest.statement}</p>
                        <div className="text-subtle font-mono mt-0.5">{latest.sourceType} · {formatDate(String(latest.observedAt))}</div>
                      </div>
                    );
                  })()
                )}
              </div>
              <div>
                <SectionLabel>Latest note</SectionLabel>
                {detail.notes.length === 0 ? (
                  <p className="text-xs text-subtle">No notes recorded.</p>
                ) : (
                  (() => {
                    const latest = detail.notes[detail.notes.length - 1];
                    return (
                      <div className="border border-border rounded-md px-3 py-2 text-xs">
                        <p className="text-muted leading-5 line-clamp-2">{latest.content}</p>
                        <div className="text-subtle font-mono mt-0.5">{latest.author} · {formatDate(String(latest.createdAt))}</div>
                      </div>
                    );
                  })()
                )}
              </div>
              <div>
                <SectionLabel>Latest action</SectionLabel>
                {detail.actions.length === 0 ? (
                  <p className="text-xs text-subtle">No actions recorded.</p>
                ) : (
                  (() => {
                    const latest = detail.actions[detail.actions.length - 1];
                    return (
                      <div className="border border-border rounded-md px-3 py-2 text-xs flex items-center gap-2">
                        <span className="text-foreground font-medium truncate">{latest.title}</span>
                        <span className="ml-auto"><Badge className={ACTION_STATUS_STYLES[latest.status]}>{latest.status.replace(/_/g, " ")}</Badge></span>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </Card>

          <Card title="Important findings">
            {detail.findings.length === 0 ? (
              <p className="text-xs text-subtle">No findings have been generated yet.</p>
            ) : (
              <div className="space-y-2">
                {detail.findings.slice(0, 4).map((finding) => (
                  <button key={finding.id} onClick={() => { setOpenFindingId(finding.id); if (detail.evidenceItems.length === 0) fetchDetail(true); }} className="w-full text-left border border-border rounded-md px-3 py-2.5 hover:border-accent/40 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={FINDING_TYPE_STYLES[finding.findingType] ?? "bg-surface-2 text-subtle border-border"}>{finding.findingType.replace(/_/g, " ")}</Badge>
                      <span className="text-sm text-foreground font-medium truncate">{finding.title}</span>
                    </div>
                    <p className="text-xs text-subtle line-clamp-2">{finding.summary}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "research-plan" && <ResearchPlanPanel investigationId={id} />}

      {isOpportunityInvestigation && activeTab === "overview" && (
        <Card title="Opportunity investigation" subtitle={detail.investigationType === "problem" ? "Signals are not proof that the problem exists." : "Service opportunity hypotheses are evidence-bounded."}>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div><div className="text-[10px] uppercase font-mono text-subtle">Objective</div><p className="text-muted mt-1">{detail.objective}</p></div>
            <div><div className="text-[10px] uppercase font-mono text-subtle">Problem / service</div><p className="text-muted mt-1">{String(detail.criteria?.problemCategory ? PROBLEM_LABELS[detail.criteria.problemCategory as keyof typeof PROBLEM_LABELS] ?? detail.criteria.problemCategory : detail.criteria?.serviceCategory ?? "Not specified")}</p></div>
          </div>
          <div className="mt-4 flex items-center gap-2"><Button onClick={handleOpportunitySynthesize} isLoading={isMarketSynthesizing}>Investigate opportunity</Button><span className="text-[10px] text-subtle">Uses existing businesses and evidence; no new Deep Search.</span></div>
          {latestOpportunitySynthesis && <div className="mt-4 border-t border-border pt-3"><div className="flex items-center gap-2 flex-wrap"><SectionLabel>Latest attempt</SectionLabel><Badge className={latestOpportunitySynthesis.validationStatus === "supported" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"}>{latestOpportunitySynthesis.status.replace(/_/g, " ")} · {latestOpportunitySynthesis.validationStatus.replace(/_/g, " ")}</Badge><span className="text-[10px] font-mono text-subtle">{latestOpportunitySynthesis.provider}{latestOpportunitySynthesis.model ? ` · ${latestOpportunitySynthesis.model}` : ""}</span></div>{latestOpportunitySynthesis.validationIssues.length > 0 && <p className="text-xs text-warning mt-1">{String(latestOpportunitySynthesis.validationIssues[0]?.message ?? "Validation issue recorded.")}</p>}</div>}
        </Card>
      )}

      {/* ===== Market Intelligence ===== */}
      {activeTab === "market-intelligence" && (
        <div className="space-y-4">
          <Card title="Market Intelligence" subtitle={latestMarketSynthesis ? `${latestMarketSynthesis.provider}${latestMarketSynthesis.model ? ` · ${latestMarketSynthesis.model}` : ""}` : "Cross-business evidence interpretation"} headerAction={<Button size="sm" variant="secondary" onClick={handleMarketSynthesize} isLoading={isMarketSynthesizing}>Run market synthesis</Button>}>
            <div className="border border-warning/30 bg-warning/5 rounded-md px-3 py-2.5 text-xs text-warning leading-5 mb-4">This analysis describes the reviewed investigation sample and should not be interpreted as a census of the entire market.</div>
            {!latestMarketSynthesis ? (
              <div className="py-5 text-center"><p className="text-sm text-subtle">No market synthesis has been generated yet.</p><p className="text-xs text-subtle mt-1">VANTAGE will calculate distinct-business aggregates before asking the AI router to explain candidate patterns.</p></div>
            ) : (
              <div className="space-y-4">
                <div className={cn("rounded-md border px-3 py-2 text-[10px] font-mono uppercase", latestMarketSynthesis.validationStatus === "supported" ? "border-success/30 bg-success/5 text-success" : "border-warning/30 bg-warning/5 text-warning")}>Trust status: {latestMarketSynthesis.validationStatus.replace(/_/g, " ")} · {latestMarketSynthesis.status.replace(/_/g, " ")}</div>
                {latestMarketSynthesis.executiveSummary && <p className="text-sm text-muted leading-6">{latestMarketSynthesis.executiveSummary}</p>}
                <div className="grid gap-2 sm:grid-cols-4 text-xs font-mono">
                  <div className="border border-border rounded-md px-3 py-2"><span className="text-subtle block text-[10px] uppercase">Sample size</span>{String((latestMarketSynthesis.aggregates?.sampleSize as number | undefined) ?? detail.metrics.businesses)}</div>
                  <div className="border border-border rounded-md px-3 py-2"><span className="text-subtle block text-[10px] uppercase">Evidence</span>{String((latestMarketSynthesis.aggregates?.evidence as { total?: number } | undefined)?.total ?? detail.metrics.evidence)}</div>
                  <div className="border border-border rounded-md px-3 py-2"><span className="text-subtle block text-[10px] uppercase">Patterns</span>{latestMarketSynthesis.patterns.length}</div>
                  <div className="border border-border rounded-md px-3 py-2"><span className="text-subtle block text-[10px] uppercase">Opportunities</span>{latestMarketSynthesis.opportunities.length}</div>
                </div>
              </div>
            )}
          </Card>
          {latestMarketSynthesis && (
            <>
              <Card title="Market patterns" subtitle="Cross-business signals grounded in distinct-business aggregates.">
                {latestMarketSynthesis.patterns.length === 0 ? <EmptyState title="No validated market patterns" description="No pattern with usable business and evidence references was persisted." /> : <div className="grid gap-3 md:grid-cols-2">{latestMarketSynthesis.patterns.map((pattern) => <Card key={pattern.id} className="shadow-none"><div className="flex items-center gap-2 flex-wrap mb-2"><Badge className="bg-accent/10 text-accent border-accent/30">{pattern.patternType.replace(/_/g, " ")}</Badge><Badge className={pattern.status === "supported" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"}>{pattern.status.replace(/_/g, " ")}</Badge><span className="text-[10px] font-mono text-subtle ml-auto">{pattern.confidence ?? "—"}%</span></div><h3 className="text-sm font-semibold text-foreground">{pattern.title}</h3><p className="text-xs text-muted mt-1 leading-5">{pattern.summary}</p><div className="flex gap-3 mt-3 pt-2 border-t border-border text-[10px] font-mono text-subtle"><span>{pattern.affectedBusinessIds.length} businesses</span><span>{pattern.evidenceIds.length} evidence</span><span>{pattern.claimType}</span></div><div className="mt-3 flex flex-wrap gap-2">{pattern.affectedBusinessIds.map((businessId) => <Button key={businessId} variant="ghost" size="sm" onClick={() => viewBusiness(businessId)}>Compare / open {businessNameById.get(businessId) ?? businessId}</Button>)}{pattern.evidenceIds.slice(0, 3).map((evidenceId) => <Button key={evidenceId} variant="ghost" size="sm" onClick={() => viewEvidenceItem(evidenceId)}>Evidence {evidenceId}</Button>)}</div></Card>)}</div>}
              </Card>
              <Card title="Market opportunity hypotheses" subtitle="These are hypotheses, not established market facts.">
                {latestMarketSynthesis.opportunities.length === 0 ? <EmptyState title="No opportunity hypotheses" description="No evidence-referenced opportunity hypothesis was returned by the market synthesis." /> : <div className="grid gap-3 md:grid-cols-2">{latestMarketSynthesis.opportunities.map((opportunity) => <Card key={opportunity.id} className="shadow-none"><div className="flex items-center gap-2 flex-wrap mb-2"><Badge className="bg-warning/10 text-warning border-warning/30">HYPOTHESIS</Badge><span className="text-[10px] font-mono text-subtle ml-auto">{opportunity.confidence ?? "—"}%</span></div><h3 className="text-sm font-semibold text-foreground">{opportunity.title}</h3><p className="text-xs text-muted mt-1 leading-5">{opportunity.statement}</p><div className="mt-2 border border-danger/30 bg-danger/5 rounded-md px-2.5 py-1.5"><span className="text-[9px] font-mono uppercase text-danger">Risks / validation</span><p className="text-xs text-subtle mt-0.5">{opportunity.riskSummary}</p></div><div className="flex gap-3 mt-3 pt-2 border-t border-border text-[10px] font-mono text-subtle"><span>{opportunity.affectedBusinessIds.length} businesses</span><span>{opportunity.evidenceIds.length} evidence</span><span>{opportunity.status.replace(/_/g, " ")}</span></div></Card>)}</div>}
              </Card>
              {latestMarketSynthesis.unknowns.length > 0 && <InvestigationUnknowns claims={[]} businessNameById={businessNameById} synthesisUnknowns={latestMarketSynthesis.unknowns} />}
            </>
          )}
        </div>
      )}

      {/* ===== Findings ===== */}
      {activeTab === "findings" && (
        <div className="space-y-3">
          {detail.findings.length === 0 ? (
            <EmptyState
              title="No findings yet"
              description="Findings are not generated automatically. They are added when evidence-backed synthesis runs or when you record them manually."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {detail.findings.map((finding) => (
                <button
                  key={finding.id}
                  onClick={() => { setOpenFindingId(finding.id); if (detail.evidenceItems.length === 0) fetchDetail(true); }}
                  className="text-left bg-surface border border-border rounded-lg p-4 hover:border-accent/40 transition-colors shadow-card"
                >
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge className={FINDING_TYPE_STYLES[finding.findingType] ?? "bg-surface-2 text-subtle border-border"}>{finding.findingType.replace(/_/g, " ")}</Badge>
                    <Badge className={finding.status === "supported" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"}>{finding.status.replace(/_/g, " ")}</Badge>
                    {typeof finding.confidence === "number" && <span className="text-[10px] font-mono text-subtle ml-auto">{finding.confidence}%</span>}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{finding.title}</h3>
                  <p className="text-xs text-subtle mt-1 leading-5 line-clamp-3">{finding.summary}</p>
                  <div className="flex gap-3 mt-3 pt-2.5 border-t border-border text-[10px] font-mono text-subtle">
                    <span>{finding.businessIds.length} businesses</span>
                    <span>{finding.claimIds.length} claims</span>
                    <span>{finding.evidenceIds.length} evidence</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isOpportunityInvestigation && activeTab === "unknowns" && (
        <Card title="Questions We Still Need Answered" subtitle="Unknowns are knowledge gaps, not negative facts.">
          {detail.claims.filter((claim) => claim.claimType === "unknown").length === 0 ? <p className="text-sm text-subtle">No explicit problem questions have been recorded yet.</p> : <ul className="list-disc list-inside space-y-2 text-sm text-muted">{detail.claims.filter((claim) => claim.claimType === "unknown").map((claim) => <li key={claim.id}>{claim.statement}</li>)}</ul>}
        </Card>
      )}

      {/* ===== Businesses ===== */}
      {activeTab === "businesses" && (
        <div className="space-y-3">
          {detail.businessDetails.length === 0 ? (
            <EmptyState title="No businesses attached" description="This investigation has no linked businesses yet. Businesses are attached when an investigation is created from a search run." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block bg-surface border border-border rounded-lg shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-2/30 text-left">
                        {["Business", "Category", "Location", "Verification", "Website health", "AI status", "Role", "Evidence", ""].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-[10px] uppercase font-mono text-subtle tracking-wider font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.businessDetails.map((business: InvestigationBusinessSummary) => (
                        <tr key={business.businessId} id={`business-row-${business.businessId}`} className="border-b border-border/60 last:border-0 hover:bg-surface-2/30 transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="text-foreground font-medium">{business.name}</div>
                            {business.includedReason && <div className="text-[10px] text-subtle mt-0.5 max-w-[220px] truncate" title={business.includedReason}>{business.includedReason}</div>}
                            {business.leadId && <a href={`/leads/${business.leadId}`} className="text-[10px] text-accent hover:underline">Open business →</a>}
                          </td>
                          <td className="px-3 py-2.5 text-muted text-xs">{business.category ?? "—"}</td>
                          <td className="px-3 py-2.5 text-muted text-xs whitespace-nowrap">{[business.city, business.country].filter(Boolean).join(", ") || "—"}</td>
                          <td className="px-3 py-2.5"><Badge className={VERIFICATION_STYLES[business.verificationStatus] ?? "bg-surface-2 text-subtle border-border"}>{business.verificationStatus}</Badge></td>
                          <td className="px-3 py-2.5 text-xs">
                            {business.website ? (
                              <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{formatDomain(business.website)}</a>
                            ) : (
                              <span className="text-subtle">none</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5"><Badge className="bg-surface-2 text-muted border-border-strong/40">{business.websiteStatus ?? "unknown"}</Badge></td>
                          <td className="px-3 py-2.5"><Badge className={business.aiStatus === "analyzed" ? "bg-info/10 text-info border-info/30" : "bg-surface-2 text-subtle border-border"}>{business.aiStatus === "analyzed" ? business.opportunityIndicator ?? "analyzed" : "not analyzed"}</Badge></td>
                          <td className="px-3 py-2.5"><Badge className="bg-surface-2 text-muted border-border-strong/40">{business.role}</Badge></td>
                          <td className="px-3 py-2.5 font-mono text-xs text-subtle">{detail.evidenceItems.filter((e) => e.businessId === business.businessId).length}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => viewEvidenceForBusiness(business.businessId)}>Evidence</Button>
                              <Select value={business.role} onChange={(e) => handleBusinessRole(business.businessId, e.target.value)} disabled={businessBusyId === business.businessId} options={[{ value: "primary", label: "Primary" }, { value: "comparison", label: "Comparison" }, { value: "candidate", label: "Candidate" }, { value: "excluded", label: "Excluded" }]} className="w-28" />
                              <Button variant="ghost" size="sm" onClick={() => handleRemoveBusiness(business.businessId, business.name)} disabled={businessBusyId === business.businessId}>Remove</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {detail.businessDetails.map((business) => (
                  <Card key={business.businessId}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-sm text-foreground font-semibold">{business.name}</span>
                      <Badge className={VERIFICATION_STYLES[business.verificationStatus] ?? "bg-surface-2 text-subtle border-border"}>{business.verificationStatus}</Badge>
                    </div>
                    <div className="text-xs text-subtle space-y-1">
                      <div>{business.category ?? "—"}</div>
                      <div>{[business.city, business.country].filter(Boolean).join(", ") || "Location unknown"}</div>
                      {business.leadId && <a href={`/leads/${business.leadId}`} className="text-accent hover:underline">Open business →</a>}
                      {business.website && <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-all">{formatDomain(business.website)}</a>}
                      <div className="font-mono text-[10px]">role: {business.role} · website: {business.websiteStatus ?? "unknown"} · AI: {business.aiStatus ?? "not analyzed"} · {detail.evidenceItems.filter((e) => e.businessId === business.businessId).length} evidence</div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap"><Button variant="secondary" size="sm" onClick={() => viewEvidenceForBusiness(business.businessId)}>View evidence</Button><Select value={business.role} onChange={(e) => handleBusinessRole(business.businessId, e.target.value)} disabled={businessBusyId === business.businessId} options={[{ value: "primary", label: "Primary" }, { value: "comparison", label: "Comparison" }, { value: "candidate", label: "Candidate" }, { value: "excluded", label: "Excluded" }]} className="w-32" /><Button variant="ghost" size="sm" onClick={() => handleRemoveBusiness(business.businessId, business.name)} disabled={businessBusyId === business.businessId}>Remove</Button></div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== Evidence ===== */}
      {activeTab === "evidence" && (
        <div className="space-y-3">
          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Source" value={evidenceSource} onChange={(e) => setEvidenceSource(e.target.value)} options={[{ value: "all", label: "All sources" }, ...evidenceSources.map((s) => ({ value: s, label: s }))]} />
              <Select label="Category" value={evidenceCategory} onChange={(e) => setEvidenceCategory(e.target.value)} options={[{ value: "all", label: "All categories" }, ...evidenceCategories.map((c) => ({ value: c, label: c.replace(/_/g, " ") }))]} />
              <Select label="Confidence" value={evidenceConfidence} onChange={(e) => setEvidenceConfidence(e.target.value)} options={[{ value: "all", label: "All confidence" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
              <Select label="Business" value={evidenceBusiness} onChange={(e) => setEvidenceBusiness(e.target.value)} options={[{ value: "all", label: "All businesses" }, ...detail.businessDetails.map((b) => ({ value: b.businessId, label: b.name }))]} />
            </div>
          </Card>
          {filteredEvidence.length === 0 ? (
            <EmptyState title="No evidence available" description={detail.evidenceItems.length === 0 ? "No evidence is linked to this investigation yet." : "No evidence matches the current filters."} />
          ) : (
            <>
              <div className="text-[11px] font-mono text-subtle">{filteredEvidence.length} of {detail.evidenceItems.length} evidence items</div>
              <div className="space-y-2">
                {filteredEvidence.map((item: InvestigationEvidenceItem) => (
                  <div key={item.id} id={`evidence-${item.id}`} className="bg-surface border border-border rounded-lg shadow-card">
                    <button className="w-full text-left px-4 py-3" onClick={() => setExpandedEvidenceId(expandedEvidenceId === item.id ? null : item.id)}>
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <Badge className={CONFIDENCE_STYLES[item.confidence] ?? CONFIDENCE_STYLES.low}>{item.confidence}</Badge>
                        <Badge className="bg-surface-2 text-muted border-border-strong/40">{item.sourceType}</Badge>
                        <Badge className="bg-surface-2 text-subtle border-border">{item.category.replace(/_/g, " ")}</Badge>
                        <span className="text-[10px] font-mono text-subtle ml-auto">{businessNameById.get(item.businessId) ?? item.businessId}</span>
                        <span className="text-[10px] text-subtle">{formatDate(String(item.observedAt))}</span>
                      </div>
                      <p className="text-sm text-muted leading-6">{item.statement}</p>
                      {item.value && <p className="text-xs text-foreground font-mono mt-1 break-all">{item.value}</p>}
                    </button>
                    {expandedEvidenceId === item.id && (
                      <div className="px-4 pb-3 pt-1 border-t border-border/60 space-y-1.5">
                        <div className="text-[10px] font-mono text-subtle">Evidence ID: <span className="text-muted">{item.id}</span></div>
                        <div className="text-[10px] font-mono text-subtle">Run: <span className="text-muted">{item.runId ?? "not run-scoped"}</span></div>
                        {item.sourceUrl ? (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline break-all">Original source: {item.sourceUrl}</a>
                        ) : (
                          <div className="text-[10px] text-subtle">No source URL recorded</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== Opportunities ===== */}
      {activeTab === "opportunities" && (
        <div className="space-y-3">
          {detail.opportunities.length === 0 ? (
            <EmptyState title="No opportunities yet" description="Opportunity hypotheses are not generated automatically. They are added through evidence-backed synthesis or manual entry." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {detail.opportunities.map((opportunity) => (
                <Card key={opportunity.id}>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge className={OPPORTUNITY_STATUS_STYLES[opportunity.status] ?? "bg-surface-2 text-subtle border-border"}>{opportunity.status.replace(/_/g, " ")}</Badge>
                    {typeof opportunity.confidence === "number" && <span className="text-[10px] font-mono text-subtle ml-auto">{opportunity.confidence}%</span>}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{opportunity.title}</h3>
                  <p className="text-xs text-muted mt-1 leading-5">{opportunity.statement}</p>
                  {opportunity.economicHypothesis && (
                    <div className="mt-2 border border-info/30 bg-info/5 rounded-md px-2.5 py-1.5">
                      <span className="text-[9px] font-mono uppercase text-info">Economic hypothesis — not verified</span>
                      <p className="text-xs text-subtle mt-0.5">{opportunity.economicHypothesis.assumptions.join(" · ")}</p>
                    </div>
                  )}
                  {opportunity.riskSummary && (
                    <div className="mt-2 border border-danger/30 bg-danger/5 rounded-md px-2.5 py-1.5">
                      <span className="text-[9px] font-mono uppercase text-danger">Risks</span>
                      <p className="text-xs text-subtle mt-0.5">{opportunity.riskSummary}</p>
                    </div>
                  )}
                  <div className="flex gap-3 mt-3 pt-2.5 border-t border-border text-[10px] font-mono text-subtle">
                    <span>{opportunity.businessIds.length} businesses</span>
                    <span>{opportunity.evidenceIds.length} evidence</span>
                    <span>{opportunity.economicHypothesis ? "assumption-based" : "no economic estimate"}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Contradictions ===== */}
      {activeTab === "contradictions" && (
        <InvestigationContradictions sourceConflicts={detail.sourceConflicts} aiConflicts={detail.aiConflicts} businessNameById={businessNameById} />
      )}

      {/* ===== Unknowns ===== */}
      {activeTab === "unknowns" && <InvestigationUnknowns claims={detail.claims} businessNameById={businessNameById} synthesisUnknowns={latestSynthesis?.unknowns ?? []} />}

      {/* ===== Actions ===== */}
      {activeTab === "actions" && (
        <div className="space-y-3">
          {detail.actions.length === 0 ? (
            <EmptyState title="No actions yet" description="Investigation actions (verify, interview, research, compare, collect data, manual review) will appear here once created." />
          ) : (
            <div className="space-y-2">
              {detail.actions.map((action) => (
                <div key={action.id} className="bg-surface border border-border rounded-lg p-4 shadow-card">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className="bg-surface-2 text-muted border-border-strong/40">{action.actionType.replace(/_/g, " ")}</Badge>
                        <Badge className={ACTION_STATUS_STYLES[action.status]}>{action.status.replace(/_/g, " ")}</Badge>
                        {action.priority > 0 && <span className="text-[10px] font-mono text-subtle">priority {action.priority}</span>}
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">{action.title}</h3>
                      {action.description && <p className="text-xs text-subtle mt-1 leading-5">{action.description}</p>}
                      <div className="text-[10px] font-mono text-subtle mt-1.5">Created {formatDate(String(action.createdAt))}</div>
                    </div>
                    <div className="shrink-0">
                      <Select
                        value={action.status}
                        onChange={(e) => handleActionStatus(action.id, e.target.value)}
                        disabled={actionBusyId === action.id}
                        options={[
                          { value: "todo", label: "To do" },
                          { value: "in_progress", label: "In progress" },
                          { value: "completed", label: "Completed" },
                          { value: "cancelled", label: "Cancelled" },
                        ]}
                        className="w-40"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Notes ===== */}
      {activeTab === "notes" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            {detail.notes.length === 0 ? (
              <EmptyState title="No notes yet" description="Human notes are first-class investigation records. They are never sent to AI automatically." />
            ) : (
              detail.notes.map((note) => (
                <Card key={note.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-accent/15 border border-accent/40 text-accent flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                      {note.author.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-foreground">{note.author}</span>
                    <span className="text-[10px] text-subtle ml-auto font-mono">{formatDate(String(note.createdAt))}</span>
                  </div>
                  <p className="text-sm text-muted leading-6 whitespace-pre-wrap">{note.content}</p>
                </Card>
              ))
            )}
          </div>
          <Card title="Add note" subtitle="Notes stay human-authored. They do not enter AI context automatically.">
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Record an observation, hypothesis, or open question..."
              rows={5}
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={handleAddNote} isLoading={isSavingNote} disabled={!noteContent.trim()}>Add Note</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ===== Search Runs ===== */}
      {activeTab === "search-runs" && <InvestigationSearchRuns runs={detail.runDetails} />}

      {/* ===== Finding drawer ===== */}
      <FindingDrawer
        finding={openFinding}
        claims={detail.claims}
        businesses={detail.businessDetails}
        evidence={detail.evidenceItems}
        actions={detail.actions}
        onClose={() => setOpenFindingId(null)}
        onBusinessOpen={viewBusiness}
        onEvidenceOpen={viewEvidenceItem}
      />

      {/* ===== Edit dialog ===== */}
      <Dialog open={showEdit} onClose={() => setShowEdit(false)} title="Edit investigation" description="Update the investigation title and objective.">
        <div className="space-y-4">
          <Input label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <Textarea label="Objective" value={editObjective} onChange={(e) => setEditObjective(e.target.value)} rows={3} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowEdit(false)} disabled={isSavingEdit}>Cancel</Button>
            <Button onClick={handleEditSave} isLoading={isSavingEdit} disabled={!editTitle.trim() || !editObjective.trim()}>Save changes</Button>
          </div>
        </div>
      </Dialog>

      {/* ===== Archive confirmation ===== */}
      <Dialog open={showArchive} onClose={() => setShowArchive(false)} title="Archive investigation" description="The investigation will move to archived status. Businesses, search runs, evidence, and analyses are not deleted.">
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={() => setShowArchive(false)} disabled={isArchiving}>Cancel</Button>
          <Button variant="danger" onClick={handleArchive} isLoading={isArchiving}>Archive investigation</Button>
        </div>
      </Dialog>
    </div>
  );
}
