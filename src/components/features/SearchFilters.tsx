"use client";

import React, { useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { CATEGORY_SUGGESTIONS, WEBSITE_STATUS_OPTIONS, SEARCH_DEPTH_OPTIONS, MAX_RESULTS_OPTIONS } from "../../lib/constants";
import { SUPPORTED_COUNTRIES } from "../../data/mockData";
import type { DiscoverFilters } from "../../lib/types";

export interface SearchFiltersProps {
  onSearch: (filters: DiscoverFilters) => void;
  isLoading?: boolean;
  isDisabled?: boolean;
}

const initialFilters: DiscoverFilters = {
  category: "",
  country: "",
  region: "",
  city: "",
  area: "",
  street: "",
  searchSource: "best-available",
  websiteStatus: "any",
  minScore: 0,
  depth: "standard",
  maxResults: 50,
  queryExpansion: true,
  evidenceEnrichment: false,
};

export function SearchFilters({ onSearch, isLoading = false, isDisabled = false }: SearchFiltersProps) {
  const [filters, setFilters] = useState<DiscoverFilters>(initialFilters);
  const [customCategory, setCustomCategory] = useState("");

  const handleInputChange = (field: keyof DiscoverFilters, value: string | number) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const category = filters.category === "__custom" ? customCategory.trim() : filters.category.trim();
    onSearch({ ...filters, category });
  };

  const categoryOptions = [
    ...CATEGORY_SUGGESTIONS.map((c) => ({ value: c, label: c })),
    { value: "__custom", label: "— Custom category —" },
  ];

  const websiteStatusOptions = WEBSITE_STATUS_OPTIONS;
  const depthOptions = SEARCH_DEPTH_OPTIONS.map((d) => ({ value: d.value as string, label: d.label }));
  const maxResultsOptions = MAX_RESULTS_OPTIONS.map((r) => ({ value: r, label: r.toString() }));
  const countryOptions = SUPPORTED_COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
  const sourceOptions = [
    { value: "best-available", label: "Best available" },
    { value: "foursquare", label: "Foursquare" },
    { value: "yelp", label: "Yelp" },
    { value: "both", label: "Both" },
  ];

  const showCustomInput = filters.category === "__custom";
  const effectiveCategory = showCustomInput ? customCategory.trim() : filters.category;
  const canSearch = Boolean(effectiveCategory) && Boolean(filters.country);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted uppercase tracking-wider">
          Business Category
        </label>
        <Select
          value={filters.category}
          onChange={(e) => handleInputChange("category", e.target.value)}
          options={categoryOptions}
          className="w-full"
        />
        {showCustomInput && (
          <Input
            placeholder="Enter custom category (e.g., Bowling alleys)"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            className="mt-2"
          />
        )}
      </div>

      {/* Geography */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted uppercase tracking-wider">
          Geography
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Select
            value={filters.country}
            onChange={(e) => handleInputChange("country", e.target.value)}
            options={[{ value: "", label: "Select country…" }, ...countryOptions]}
          />
          <Input
            placeholder="Region / State / Province"
            value={filters.region}
            onChange={(e) => handleInputChange("region", e.target.value)}
          />
          <Input
            placeholder="City"
            value={filters.city}
            onChange={(e) => handleInputChange("city", e.target.value)}
          />
          <Input
            placeholder="Area / Neighborhood"
            value={filters.area}
            onChange={(e) => handleInputChange("area", e.target.value)}
          />
          <Input
            placeholder="Street"
            value={filters.street}
            onChange={(e) => handleInputChange("street", e.target.value)}
          />
        </div>
      </div>

      {/* Search Options */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted uppercase tracking-wider">
          Search Options
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Select
            value={filters.searchSource}
            onChange={(e) => handleInputChange("searchSource", e.target.value as DiscoverFilters["searchSource"])}
            options={sourceOptions}
          />
          <Select
            value={filters.websiteStatus}
            onChange={(e) => handleInputChange("websiteStatus", e.target.value as DiscoverFilters["websiteStatus"])}
            options={websiteStatusOptions}
          />
          <Input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.minScore}
            onChange={(e) => handleInputChange("minScore", parseInt(e.target.value, 10))}
            label="Min Opportunity Score"
          />
          <Select
            value={filters.depth}
            onChange={(e) => handleInputChange("depth", e.target.value as DiscoverFilters["depth"])}
            options={depthOptions}
          />
          <Select
            value={filters.maxResults}
            onChange={(e) => handleInputChange("maxResults", parseInt(e.target.value, 10))}
            options={maxResultsOptions}
          />
          <label className="flex items-center gap-2 text-xs text-subtle border border-border rounded px-2 py-2">
            <input type="checkbox" checked={Boolean(filters.queryExpansion)} onChange={(event) => setFilters({ ...filters, queryExpansion: event.target.checked })} className="accent-accent" />
            Query expansion
          </label>
          <label className="flex items-center gap-2 text-xs text-subtle border border-border rounded px-2 py-2">
            <input type="checkbox" checked={Boolean(filters.evidenceEnrichment)} onChange={(event) => setFilters({ ...filters, evidenceEnrichment: event.target.checked })} className="accent-accent" />
            Evidence enrichment
          </label>
          <Select
            value={filters.webDiscoveryProvider ?? "best-available"}
            onChange={(event) => setFilters({ ...filters, webDiscoveryProvider: event.target.value as DiscoverFilters["webDiscoveryProvider"] })}
            options={[{ value: "best-available", label: "Web discovery: Automatic" }, { value: "tavily", label: "Web discovery: Tavily" }, { value: "exa", label: "Web discovery: Exa" }, { value: "both", label: "Web discovery: Both" }]}
          />
        </div>
      </div>

      {/* Submit */}
      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          disabled={isDisabled || !canSearch}
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
          className="w-full sm:w-auto font-mono tracking-tight"
        >
          {isLoading ? "Searching…" : "FIND OPPORTUNITIES"}
        </Button>
      </div>
    </form>
  );
}
