import type { DiscoverySourceSelection, WebDiscoveryProviderSelection } from "@/lib/types";

export type DiscoveryDepth = "quick" | "standard" | "deep";
export type DiscoveryMode = "primary" | "fallback" | "multi-source";
export type DiscoverySource = "foursquare" | "yelp";
export type BusinessProviderSource = "foursquare" | "yelp";
export type NormalizedBusinessSource = "foursquare" | "yelp" | "web";

export interface DiscoveryQuery {
  category: string;
  country: string;
  countryCode?: string;
  countryName?: string;
  region?: string;
  city?: string;
  area?: string;
  street?: string;
  latitude?: number;
  longitude?: number;
  limit: number;
  depth: DiscoveryDepth;
  searchSource?: DiscoverySourceSelection;
  queryExpansion?: boolean;
  evidenceEnrichment?: boolean;
  webDiscoveryProvider?: WebDiscoveryProviderSelection;
}

export interface NormalizedBusiness {
  externalId: string;
  source: NormalizedBusinessSource;
  name: string;
  category?: string;
  address?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  area?: string;
  street?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
}

export type ProviderStatus = "success" | "zero-results" | "unavailable" | "rate-limited" | "invalid-request" | "unexpected-response" | "timeout" | "failed";

export interface ProviderSearchResult {
  provider: BusinessProviderSource;
  status: ProviderStatus;
  results: NormalizedBusiness[];
  errorMessage?: string;
}

export interface BusinessDiscoveryProvider {
  name: BusinessProviderSource;
  search(query: DiscoveryQuery): Promise<ProviderSearchResult>;
}
