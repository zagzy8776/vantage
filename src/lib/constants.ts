import type { PipelineStage, WebsiteStatusFilter } from "./types";

/** Pipeline stages in order. */
export const PIPELINE_STAGES: PipelineStage[] = [
  "discovered",
  "analyzing",
  "qualified",
  "contacted",
  "replied",
  "won",
];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  discovered: "Discovered",
  analyzing: "Analyzing",
  qualified: "Qualified",
  contacted: "Contacted",
  replied: "Replied",
  won: "Won",
};

/**
 * Suggested business categories for the Discover page.
 * Suggestions only — arbitrary custom categories are always allowed.
 */
export const CATEGORY_SUGGESTIONS: string[] = [
  "Dental clinics",
  "Real estate",
  "Beauty & aesthetics",
  "Hotels & hospitality",
  "Perfume stores",
  "Bags & leather goods",
  "Clothing & fashion",
  "Schools & education",
  "Restaurants",
  "Cosmetics & skincare",
  "Jewelry",
  "Hospitals & clinics",
  "Barbershops",
  "Spas & wellness",
  "Gyms & fitness",
  "Law firms",
  "Photography",
  "Auto dealerships",
  "Contractors & trades",
];

export const WEBSITE_STATUS_OPTIONS: Array<{
  value: WebsiteStatusFilter;
  label: string;
}> = [
  { value: "any", label: "Any website status" },
  { value: "no-website", label: "No website" },
  { value: "poor", label: "Poor website" },
  { value: "has-website", label: "Has website" },
];

export const SEARCH_DEPTH_OPTIONS = [
  { value: "quick", label: "Quick — top matches" },
  { value: "standard", label: "Standard — balanced" },
  { value: "deep", label: "Deep — slower, thorough" },
] as const;

export const MAX_RESULTS_OPTIONS = [25, 50, 100, 250] as const;

export const MIN_SCORE_STEP = 5;

/** Standard disclaimer shown wherever mock data is displayed. */
export const MOCK_DATA_DISCLAIMER =
  "All records are fictional mock data for the Phase 1 interface preview. Live discovery, analysis and scoring arrive in later phases.";
