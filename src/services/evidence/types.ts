import type { BusinessVerificationStatus } from "@/lib/types";

export type EvidenceCategory = "business_identity" | "business_category" | "location" | "contact" | "website" | "services" | "products" | "pricing" | "booking" | "ecommerce" | "social_presence" | "opening_hours" | "about" | "technology" | "customer_signal" | "brand_signal" | "content_signal";
export type EvidenceSourceType = "foursquare" | "yelp" | "tavily" | "exa" | "firecrawl" | "pagespeed" | "website" | "public_page" | "search_result";
export type EvidenceConfidence = "high" | "medium" | "low";

export interface EvidenceItem {
  id?: string;
  businessId: string;
  category: EvidenceCategory;
  statement: string;
  value?: string;
  sourceType: EvidenceSourceType;
  sourceUrl?: string;
  confidence: EvidenceConfidence;
  observedAt: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceSearchQuery {
  businessId?: string;
  businessName: string;
  location?: string;
  category?: string;
  limit: number;
  country?: string;
  query?: string;
}

export type EvidenceSearchStatus = "success" | "zero-results" | "rate-limited" | "unavailable" | "malformed-response" | "timeout" | "failed";

export interface EvidenceSearchResultItem {
  title: string;
  url: string;
  snippet?: string;
  rank?: number;
  publishedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceSearchResult {
  provider: string;
  status: EvidenceSearchStatus;
  results: EvidenceSearchResultItem[];
  evidence: EvidenceItem[];
  queryCount: number;
  errorMessage?: string;
  httpStatus?: number;
  failureCategory?: "authentication" | "rate_limit" | "provider_error" | "timeout" | "network" | "malformed_response" | "configuration";
  providerCode?: string;
  durationMs?: number;
  providerDiagnostics?: Array<{ httpStatus?: number; failureCategory?: string; providerCode?: string; safeMessage?: string; durationMs?: number }>;
}

export interface EvidenceSearchProvider {
  name: string;
  search(query: EvidenceSearchQuery): Promise<EvidenceSearchResult>;
}

export interface WebsiteResearchLimits {
  maxPages: number;
  timeoutMs: number;
  maxBodyCharacters: number;
}

export interface WebsiteResearchResult {
  businessId: string;
  websiteUrl: string;
  pagesFetched: string[];
  evidence: EvidenceItem[];
  verificationStatus: BusinessVerificationStatus;
  errors: string[];
  diagnostics?: WebsiteResearchDiagnostic[];
}

export interface WebsiteResearchDiagnostic {
  domain: string;
  httpStatus?: number;
  failureCategory?: "authentication" | "request_schema" | "url_validation" | "rate_limit" | "timeout" | "provider_error" | "network" | "unknown";
  providerCode?: string;
  safeMessage?: string;
  requestConstructed: boolean;
  timedOut?: boolean;
  durationMs: number;
}

export type EvidenceFreshness = "fresh" | "aging" | "stale";
export type EvidenceConflictStatus = "none" | "conflicting" | "requires-review";

export interface EvidenceConflict {
  businessId: string;
  category: EvidenceCategory;
  fieldKey: string;
  status: EvidenceConflictStatus;
  items: EvidenceItem[];
  observedAt: string;
}

/** Default public-site crawl depth — higher = more contact/booking signals found. */
export const DEFAULT_WEBSITE_RESEARCH_LIMITS: WebsiteResearchLimits = {
  maxPages: 12,
  timeoutMs: 25_000,
  maxBodyCharacters: 600_000,
};
