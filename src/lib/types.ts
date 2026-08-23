/**
 * VANTAGE — shared domain types.
 *
 * Phase 1: these interfaces describe the contracts the mock-data layer
 * fulfils today and the future database / provider modules will fill with
 * real data in later phases.
 */

/** Pipeline stages a lead moves through, in order. */
export type PipelineStage =
  | "discovered"
  | "analyzing"
  | "qualified"
  | "contacted"
  | "replied"
  | "won";

/** Where a business record originally came from. */
export type LeadSource = "foursquare" | "yelp" | "manual" | "import" | "web";

/** Search source selection shown in the Discover UI. */
export type DiscoverySourceSelection = "best-available" | "foursquare" | "yelp" | "both";
export type WebDiscoveryProviderSelection = "best-available" | "tavily" | "exa" | "both";

/** Coarse website state used as a discovery filter. */
export type WebsiteStatusFilter = "any" | "no-website" | "poor" | "has-website";

/** Website health classification produced by website analysis. */
export type WebsiteHealth = "none" | "unknown" | "unreachable" | "poor" | "fair" | "good";

/** AI opportunity classification, kept separate from the deterministic discovery score. */
export type AIOpportunityLevel = "very-low" | "low" | "medium" | "high" | "very-high";

export type BusinessVerificationStatus = "verified" | "likely" | "uncertain" | "rejected";

/** Score layers remain independent until a future composite score is explicitly introduced. */
export interface OpportunityScoreStack {
  initialScore: number;
  technicalWebsiteScore?: number | null;
  aiOpportunityScore?: number | null;
  compositeOpportunityScore?: number | null;
}

/** PageSpeed / website-analysis execution strategy. */
export type WebsiteAnalysisStrategy = "mobile" | "desktop";

/** Execution state for a website-analysis observation. */
export type WebsiteAnalysisStatus = "success" | "failed";

/** Structured evidence gathered from a website analysis run. */
export interface WebsiteEvidence {
  hasWebsite: boolean;
  reachable?: boolean;
  reachability?: "reachable" | "unreachable" | "not-established";
  analysisStatus?: "success" | "failed";
  performance?: number;
  accessibility?: number;
  bestPractices?: number;
  seo?: number;
  mobilePerformance?: number;
  desktopPerformance?: number;
}

/** Summary of the latest website intelligence for a business. */
export interface WebsiteAnalysisSummary {
  id?: string;
  businessId?: string;
  url: string;
  canonicalUrl: string;
  normalizedUrl: string;
  strategy?: WebsiteAnalysisStrategy;
  status: WebsiteAnalysisStatus;
  errorCode?: string | null;
  analyzedAt: string;
  performanceScore?: number | null;
  accessibilityScore?: number | null;
  bestPracticesScore?: number | null;
  seoScore?: number | null;
  mobileScore?: number | null;
  desktopScore?: number | null;
  reused?: boolean;
  technicalHealthScore?: number | null;
  websiteStatus?: WebsiteHealth;
  evidence: WebsiteEvidence;
}

/** Opportunity-score severity tiers. */
export type ScoreTier = "exceptional" | "high" | "promising" | "moderate" | "low";

/** Geographic scope of a business or a search. */
export interface GeoLocation {
  country: string;
  countryCode: string;
  region?: string;
  city: string;
  area?: string;
  street?: string;
}

/** A discovered business. Future DB entity: `businesses`. */
export interface Business {
  id: string;
  name: string;
  category: string;
  location: GeoLocation;
  website: string | null;
  phone: string | null;
  source: LeadSource;
  /** All provider sources that contributed to this business record. */
  sources?: LeadSource[];
  /** ISO date string. */
  discoveredAt: string;
}

/** Website analysis results (0–100 per metric, null when not applicable). */
export interface WebsiteIntelligenceMetrics {
  performance: number;
  mobile: number;
  accessibility: number;
  bestPractices?: number;
  seo: number;
  security: number;
  conversion: number;
  /** Online booking / self-scheduling capability. */
  booking: number | null;
  /** E-commerce capability. */
  ecommerce: number | null;
  desktop?: number;
}

/** A scored, tracked lead. Future DB entities: `leads`, `lead_scores`. */
export interface Lead {
  id: string;
  business: Business;
  /** 0–100 opportunity score. */
  opportunityScore: number;
  /** AI opportunity score; never replaces the initial deterministic score. */
  aiOpportunityScore?: number | null;
  aiOpportunityLevel?: AIOpportunityLevel | null;
  aiAnalyzedAt?: string | null;
  websiteHealth: WebsiteHealth;
  websiteAnalysis?: WebsiteAnalysisSummary | null;
  websiteEvidence?: WebsiteEvidence | null;
  status: PipelineStage;
  /** ISO date string; null when not yet analyzed. */
  lastAnalyzedAt: string | null;
  /** Short human-readable explanation of the score. */
  reason: string;
  website: WebsiteIntelligenceMetrics | null;
}

/** Search filters used by the Discover page. */
export interface DiscoverFilters {
  category: string;
  country: string;
  region: string;
  city: string;
  area: string;
  street: string;
  searchSource: DiscoverySourceSelection;
  websiteStatus: WebsiteStatusFilter;
  minScore: number;
  depth: "quick" | "standard" | "deep";
  maxResults: number;
  queryExpansion?: boolean;
  evidenceEnrichment?: boolean;
  webDiscoveryProvider?: WebDiscoveryProviderSelection;
}

/** Overview dashboard headline statistics. */
export interface OverviewStats {
  businessesDiscovered: number;
  websitesAnalyzed: number;
  highOpportunityLeads: number;
  activeAutomations: number;
}

/** Summary row for the Automations page. */
export interface AutomationSummary {
  id: string;
  name: string;
  description: string;
  trigger: string;
  status: "active" | "paused";
  lastRunAt: string | null;
}

/** Descriptor for a pluggable external provider (Phase 2). */
export interface ProviderDescriptor {
  id: string;
  name: string;
  kind: "business" | "website" | "ai" | "email";
  description: string;
  /** Server-side environment variable that will hold its key. */
  envKey: string;
}
