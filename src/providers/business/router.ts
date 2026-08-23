import { calculateInitialOpportunityScore } from "@/lib/discover/score";
import { businessKeyParts, estimateBusinessEvidenceScore } from "./shared";
import { providerRegistry } from "./registry";
import type { DiscoveryMode, DiscoveryQuery, DiscoverySource, NormalizedBusiness, ProviderSearchResult } from "./types";
import type { DiscoverySourceSelection } from "@/lib/types";
import { timeoutMs, withTimeout } from "@/lib/reliability/timeout";

export interface ProviderSummary {
  status: ProviderSearchResult["status"] | "not-queried";
  count: number;
  queried: boolean;
  errorMessage?: string;
}

export interface DiscoveryCluster {
  canonical: NormalizedBusiness;
  records: NormalizedBusiness[];
  confidence: "high" | "medium" | "low";
}

export interface DiscoveryRunResult {
  clusters: DiscoveryCluster[];
  results: NormalizedBusiness[];
  resultSources: Array<NormalizedBusiness["source"][]>;
  totalUniqueResults: number;
  providers: Record<DiscoverySource, ProviderSummary>;
  queriedProviders: DiscoverySource[];
  fallbackUsed: boolean;
  mode: DiscoveryMode;
  requestedProvider: DiscoverySourceSelection;
}

export interface RouterOptions {
  mode: DiscoveryMode;
  primary?: DiscoverySource;
  requestedProvider?: DiscoverySourceSelection;
  allowFallback?: boolean;
}

function isProviderUseful(result: ProviderSearchResult) {
  return result.status === "success" && result.results.length > 0;
}

function shouldFallback(result: ProviderSearchResult) {
  return result.status === "zero-results" || result.status === "unavailable" || result.status === "rate-limited" || result.status === "unexpected-response" || result.status === "timeout" || result.status === "failed";
}

function confidenceForMatch(a: NormalizedBusiness, b: NormalizedBusiness) {
  const left = businessKeyParts(a);
  const right = businessKeyParts(b);
  const samePhone = left.phone && right.phone && left.phone === right.phone;
  const sameWebsite = left.website && right.website && left.website === right.website;
  const sameCoordinates = typeof a.latitude === "number" && typeof a.longitude === "number" && typeof b.latitude === "number" && typeof b.longitude === "number"
    ? Math.abs(a.latitude - b.latitude) < 0.0003 && Math.abs(a.longitude - b.longitude) < 0.0003
    : false;
  const sameName = left.name && left.name === right.name;
  const sameCity = left.city && left.city === right.city;
  const sameCountry = left.country && left.country === right.country;
  const sameAddress = left.address && right.address && left.address === right.address;

  if (samePhone || sameWebsite) return { level: "high" as const, score: 3 };
  if (sameCoordinates && sameName) return { level: "high" as const, score: 3 };
  if (sameName && sameCity && sameCountry && sameAddress) return { level: "medium" as const, score: 2 };
  if (sameName && sameCity) return { level: "low" as const, score: 1 };
  return { level: "low" as const, score: 0 };
}

function mergeBusinesses(existing: NormalizedBusiness, incoming: NormalizedBusiness): NormalizedBusiness {
  return {
    ...existing,
    category: existing.category ?? incoming.category,
    address: existing.address ?? incoming.address,
    country: existing.country ?? incoming.country,
    region: existing.region ?? incoming.region,
    city: existing.city ?? incoming.city,
    area: existing.area ?? incoming.area,
    street: existing.street ?? incoming.street,
    latitude: existing.latitude ?? incoming.latitude,
    longitude: existing.longitude ?? incoming.longitude,
    phone: existing.phone ?? incoming.phone,
    website: existing.website ?? incoming.website,
    rating: existing.rating ?? incoming.rating,
    reviewCount: existing.reviewCount ?? incoming.reviewCount,
    priceLevel: existing.priceLevel ?? incoming.priceLevel,
  };
}

export function deduplicateBusinesses(businesses: NormalizedBusiness[]) {
  const relationships: Array<{ left: NormalizedBusiness; right: NormalizedBusiness; confidence: "high" | "medium" | "low" }> = [];
  const clusters: DiscoveryCluster[] = [];

  for (const business of businesses) {
    let matchIndex = -1;
    let bestScore = 0;
    let matchConfidence: "high" | "medium" | "low" = "low";

    for (let index = 0; index < clusters.length; index += 1) {
      const candidate = clusters[index]!.canonical;
      const confidence = confidenceForMatch(candidate, business);
      if (confidence.score > bestScore) {
        bestScore = confidence.score;
        matchIndex = index;
        matchConfidence = confidence.level;
      }
    }

    if (matchIndex === -1 || bestScore === 0) {
      clusters.push({ canonical: business, records: [business], confidence: "low" });
      continue;
    }

    const cluster = clusters[matchIndex]!;
    if (matchConfidence === "high") {
      cluster.canonical = mergeBusinesses(cluster.canonical, business);
      cluster.records.push(business);
      cluster.confidence = "high";
    } else {
      relationships.push({ left: cluster.canonical, right: business, confidence: matchConfidence });
      clusters.push({ canonical: business, records: [business], confidence: matchConfidence });
    }
  }

  return { clusters, relationships };
}

function rankClusters(clusters: DiscoveryCluster[]) {
  return [...clusters].sort((a, b) => {
    const aScore = calculateInitialOpportunityScore(a.canonical).score + estimateBusinessEvidenceScore(a.canonical);
    const bScore = calculateInitialOpportunityScore(b.canonical).score + estimateBusinessEvidenceScore(b.canonical);
    if (bScore !== aScore) return bScore - aScore;
    return a.canonical.name.toLowerCase().localeCompare(b.canonical.name.toLowerCase());
  });
}

function clusterSources(cluster: DiscoveryCluster): NormalizedBusiness["source"][] {
  return Array.from(new Set(cluster.records.map((record) => record.source)));
}

async function queryProvider(providerName: DiscoverySource, query: DiscoveryQuery): Promise<ProviderSearchResult> {
  try {
    return await withTimeout(providerRegistry[providerName].search(query), timeoutMs("BUSINESS_PROVIDER_TIMEOUT_MS", 20_000), `${providerName} business discovery`);
  } catch (error) {
    return { provider: providerName, status: "timeout", results: [], errorMessage: error instanceof Error ? "Business provider timed out." : "Business provider failed." };
  }
}

function buildProviderSummary(result?: ProviderSearchResult): ProviderSummary {
  if (!result) return { status: "not-queried", count: 0, queried: false };
  return { status: result.status, count: result.results.length, queried: true, errorMessage: result.errorMessage };
}

export async function runBusinessDiscovery(query: DiscoveryQuery, options: RouterOptions): Promise<DiscoveryRunResult> {
  if (options.mode === "multi-source") {
    const queriedProviders: DiscoverySource[] = ["foursquare", "yelp"];
    const foursquare = await queryProvider("foursquare", query);
    const yelp = await queryProvider("yelp", query);
    const combined = deduplicateBusinesses([...foursquare.results, ...yelp.results]);
    const ranked = rankClusters(combined.clusters);

    return {
      clusters: ranked,
      results: ranked.map((cluster) => cluster.canonical),
      resultSources: ranked.map(clusterSources),
      totalUniqueResults: ranked.length,
      providers: { foursquare: buildProviderSummary(foursquare), yelp: buildProviderSummary(yelp) },
      queriedProviders,
      fallbackUsed: false,
      mode: options.mode,
      requestedProvider: options.requestedProvider ?? "both",
    };
  }

  const primaryProvider = options.primary ?? "foursquare";
  const fallbackProvider: DiscoverySource = primaryProvider === "foursquare" ? "yelp" : "foursquare";
  const queriedProviders: DiscoverySource[] = [primaryProvider];
  const primary = await queryProvider(primaryProvider, query);

  const providerSummary = (result: ProviderSearchResult) => ({
    foursquare: primaryProvider === "foursquare" ? buildProviderSummary(result) : { status: "not-queried" as const, count: 0, queried: false },
    yelp: primaryProvider === "yelp" ? buildProviderSummary(result) : { status: "not-queried" as const, count: 0, queried: false },
  });

  if (!options.allowFallback) {
    const combined = deduplicateBusinesses(primary.results);
    const ranked = rankClusters(combined.clusters);
    return {
      clusters: ranked,
      results: ranked.map((cluster) => cluster.canonical),
      resultSources: ranked.map(clusterSources),
      totalUniqueResults: ranked.length,
      providers: providerSummary(primary),
      queriedProviders,
      fallbackUsed: false,
      mode: options.mode,
      requestedProvider: options.requestedProvider ?? primaryProvider,
    };
  }

  if (isProviderUseful(primary)) {
    const combined = deduplicateBusinesses(primary.results);
    const ranked = rankClusters(combined.clusters);
    return {
      clusters: ranked,
      results: ranked.map((cluster) => cluster.canonical),
      resultSources: ranked.map(clusterSources),
      totalUniqueResults: ranked.length,
      providers: providerSummary(primary),
      queriedProviders,
      fallbackUsed: false,
      mode: options.mode,
      requestedProvider: options.requestedProvider ?? "best-available",
    };
  }

  if (!shouldFallback(primary)) {
    return {
      clusters: [],
      results: [],
      resultSources: [],
      totalUniqueResults: 0,
      providers: providerSummary(primary),
      queriedProviders,
      fallbackUsed: false,
      mode: options.mode,
      requestedProvider: options.requestedProvider ?? "best-available",
    };
  }

  queriedProviders.push(fallbackProvider);
  const fallback = await queryProvider(fallbackProvider, query);
  const combined = deduplicateBusinesses([...primary.results, ...fallback.results]);
  const ranked = rankClusters(combined.clusters);

  return {
    clusters: ranked,
    results: ranked.map((cluster) => cluster.canonical),
    resultSources: ranked.map(clusterSources),
    totalUniqueResults: ranked.length,
      providers: {
        foursquare: primaryProvider === "foursquare" ? buildProviderSummary(primary) : buildProviderSummary(fallback),
        yelp: primaryProvider === "yelp" ? buildProviderSummary(primary) : buildProviderSummary(fallback),
      },
    queriedProviders,
    fallbackUsed: true,
    mode: options.mode,
      requestedProvider: options.requestedProvider ?? "best-available",
  };
}
