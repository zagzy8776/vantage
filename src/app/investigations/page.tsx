"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { InvestigationSummary } from "@/services/investigations/types";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

const TYPE_LABELS: Record<string, string> = {
  company: "Company",
  industry: "Industry",
  market: "Market",
  problem: "Problem",
  service_opportunity: "Service Opportunity",
};

export default function InvestigationsListPage() {
  const [investigations, setInvestigations] = useState<InvestigationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  const fetchInvestigations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/investigations?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch investigations");
      const data = await res.json();
      setInvestigations(data.items);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / data.pageSize));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load investigations");
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    fetchInvestigations();
  }, [fetchInvestigations]);

  const filteredInvestigations = investigations.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.title.toLowerCase().includes(q) ||
      (inv.industry?.toLowerCase().includes(q) ?? false) ||
      (inv.city?.toLowerCase().includes(q) ?? false) ||
      (inv.country?.toLowerCase().includes(q) ?? false)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-info/10 text-info border-info/30";
      case "completed": return "bg-success/10 text-success border-success/30";
      case "draft": return "bg-subtle/10 text-subtle border-subtle/30";
      case "archived": return "bg-muted/10 text-muted border-muted/30";
      default: return "bg-surface-2 text-subtle border-border";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold font-mono">Investigations</h1>
          <p className="text-sm text-subtle mt-1">Persistent research workspaces built from completed Deep Search runs.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/investigations/new">
            <Button variant="primary" leftIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}>
              New Investigation
            </Button>
          </Link>
          <Link href="/discover">
            <Button variant="secondary" leftIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}>
              From Search Run
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Search title, industry, city, country..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="flex-1 max-w-md"
            leftIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
          />
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            options={STATUS_OPTIONS}
            className="w-full sm:w-48"
          />
        </div>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-4 bg-surface-2 rounded mb-3"></div>
              <div className="h-3 bg-surface-2 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-surface-2 rounded w-1/2"></div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Failed to load investigations" description={error} />
      ) : filteredInvestigations.length === 0 ? (
        <EmptyState
          title="No investigations found"
          description={searchQuery || statusFilter !== "all"
            ? "Try adjusting your search or filters."
            : "Investigations are created from completed Deep Search runs. Go to Discover to run a search, then create an investigation from the results."}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredInvestigations.map((inv) => (
              <Link key={inv.id} href={`/investigations/${inv.id}`}>
                <Card className="hover:border-accent/30 transition-colors cursor-pointer group">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-medium tracking-tight whitespace-nowrap select-none ${getStatusColor(inv.status)}`}>
                      {inv.status.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-subtle font-mono uppercase tracking-wider">{TYPE_LABELS[inv.type] || inv.type}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors truncate">{inv.title}</h3>
                  <p className="text-[10px] text-subtle mt-1 line-clamp-2">{inv.objective}</p>
                  <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-mono text-subtle">
                    <span className="flex items-center gap-1">{inv.businessCount} businesses</span>
                    <span className="flex items-center gap-1">{inv.searchRunCount} runs</span>
                    {(inv.city || inv.country) && <span className="flex items-center gap-1">{[inv.city, inv.country].filter(Boolean).join(", ")}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
                    <span className="text-[10px] text-subtle">Created {formatDate(String(inv.createdAt))}</span>
                    <span className="text-[10px] text-subtle">Updated {formatDate(String(inv.updatedAt))}</span>
                    <span className="text-[10px] text-accent font-mono">Open →</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </Button>
              <span className="text-sm text-subtle">Page {page} of {totalPages} ({total} total)</span>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}