import { calculateInitialOpportunityScore } from "@/lib/discover/score";
import { businessKeyParts, estimateBusinessEvidenceScore } from "./shared";
import { providerRegistry } from "./registry";
import type { DiscoveryMode, DiscoveryQuery, DiscoverySource, NormalizedBusiness, ProviderSearchResult } from "./types";
import type { DiscoverySourceSelection } from "@/lib/types";
import { timeoutMs, withTimeout } from "@/lib/reliability/timeout";
import { searchEvidence } from "@/providers/evidence-search/router";

export interface ProviderSummary { status: ProviderSearchResult["status"] | "not-queried"; count: number; queried: boolean; errorMessage?: string; }
export interface DiscoveryCluster { canonical: NormalizedBusiness; records: NormalizedBusiness[]; confidence: "high" | "medium" | "low"; }
export interface DiscoveryRunResult { clusters: DiscoveryCluster[]; results: NormalizedBusiness[]; resultSources: Array<NormalizedBusiness["source"][]>; totalUniqueResults: number; providers: Record<DiscoverySource, ProviderSummary>; queriedProviders: DiscoverySource[]; fallbackUsed: boolean; mode: DiscoveryMode; requestedProvider: DiscoverySourceSelection; }
export interface RouterOptions { mode: DiscoveryMode; primary?: DiscoverySource; requestedProvider?: DiscoverySourceSelection; allowFallback?: boolean; }

function confidenceForMatch(a: NormalizedBusiness, b: NormalizedBusiness) { const left = businessKeyParts(a); const right = businessKeyParts(b); const samePhone = left.phone && right.phone && left.phone === right.phone; const sameWebsite = left.website && right.website && left.website === right.website; const sameCoordinates = typeof a.latitude === "number" && typeof a.longitude === "number" && typeof b.latitude === "number" && typeof b.longitude === "number" ? Math.abs(a.latitude - b.latitude) < 0.0003 && Math.abs(a.longitude - b.longitude) < 0.0003 : false; const sameName = left.name && left.name === right.name; const sameCity = left.city && left.city === right.city; const sameCountry = left.country && right.country && left.country === right.country; const sameAddress = left.address && right.address && left.address === right.address; if (samePhone || sameWebsite) return { level: "high" as const, score: 3 }; if (sameCoordinates && sameName) return { level: "high" as const, score: 3 }; if (sameName && sameCity && sameCountry && sameAddress) return { level: "medium" as const, score: 2 }; if (sameName && sameCity) return { level: "low" as const, score: 1 }; return { level: "low" as const, score: 0 }; }
function mergeBusinesses(existing: NormalizedBusiness, incoming: NormalizedBusiness): NormalizedBusiness { return { ...existing, category: existing.category ?? incoming.category, address: existing.address ?? incoming.address, country: existing.country ?? incoming.country, region: existing.region ?? incoming.region, city: existing.city ?? incoming.city, area: existing.area ?? incoming.area, street: existing.street ?? incoming.street, latitude: existing.latitude ?? incoming.latitude, longitude: existing.longitude ?? incoming.longitude, phone: existing.phone ?? incoming.phone, website: existing.website ?? incoming.website, rating: existing.rating ?? incoming.rating, reviewCount: existing.reviewCount ?? incoming.reviewCount, priceLevel: existing.priceLevel ?? incoming.priceLevel }; }
export function deduplicateBusinesses(businesses: NormalizedBusiness[]) { const relationships: Array<{ left: NormalizedBusiness; right: NormalizedBusiness; confidence: "high" | "medium" | "low" }> = []; const clusters: DiscoveryCluster[] = []; for (const business of businesses) { let matchIndex = -1; let bestScore = 0; let matchConfidence: "high" | "medium" | "low" = "low"; for (let index = 0; index < clusters.length; index += 1) { const candidate = clusters[index]!.canonical; const confidence = confidenceForMatch(candidate, business); if (confidence.score > bestScore) { bestScore = confidence.score; matchIndex = index; matchConfidence = confidence.level; } } if (matchIndex === -1 || bestScore === 0) { clusters.push({ canonical: business, records: [business], confidence: "low" }); continue; } const cluster = clusters[matchIndex]!; if (matchConfidence === "high") { cluster.canonical = mergeBusinesses(cluster.canonical, business); cluster.records.push(business); cluster.confidence = "high"; } else { relationships.push({ left: cluster.canonical, right: business, confidence: matchConfidence }); clusters.push({ canonical: business, records: [business], confidence: matchConfidence }); } } return { clusters, relationships }; }
function rankClusters(clusters: DiscoveryCluster[], limit: number) { return [...clusters].sort((a, b) => { const aScore = calculateInitialOpportunityScore(a.canonical).score + estimateBusinessEvidenceScore(a.canonical); const bScore = calculateInitialOpportunityScore(b.canonical).score + estimateBusinessEvidenceScore(b.canonical); if (bScore !== aScore) return bScore - aScore; return a.canonical.name.toLowerCase().localeCompare(b.canonical.name.toLowerCase()); }).slice(0, Math.max(0, limit)); }
function clusterSources(cluster: DiscoveryCluster): NormalizedBusiness["source"][] { return Array.from(new Set(cluster.records.map((record) => record.source))); }
async function queryProvider(providerName: DiscoverySource, query: DiscoveryQuery): Promise<ProviderSearchResult> { try { return await withTimeout(providerRegistry[providerName].search(query), timeoutMs("BUSINESS_PROVIDER_TIMEOUT_MS", 20_000), `${providerName} business discovery`); } catch { return { provider: providerName, status: "timeout", results: [], errorMessage: "Business provider timed out." }; } }
function buildProviderSummary(result?: ProviderSearchResult): ProviderSummary { if (!result) return { status: "not-queried", count: 0, queried: false }; return { status: result.status, count: result.results.length, queried: true, errorMessage: result.errorMessage }; }
function mergeResults(results: ProviderSearchResult[]) { return deduplicateBusinesses(results.flatMap((result) => result.results)); }

function normalizeMatchText(value: string) { return value.toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9]+/g, " ").trim(); }
function businessNameTokens(name: string) { return normalizeMatchText(name).split(/\s+/).filter((token) => token.length >= 3 && !["the", "and", "for", "ltd", "limited", "llc", "inc", "company", "co"].includes(token)); }
function searchResultRelevance(item: { title: string; url: string; snippet?: string }, business: NormalizedBusiness, location: string) {
  const title = normalizeMatchText(item.title);
  const body = normalizeMatchText(`${item.snippet ?? ""} ${item.url}`);
  const tokens = businessNameTokens(business.name);
  if (!tokens.length) return 0;
  const matchedTokens = tokens.filter((token) => title.includes(token) || body.includes(token));
  const nameCoverage = matchedTokens.length / tokens.length;
  let score = nameCoverage * 5;
  if (title.includes(normalizeMatchText(business.name))) score += 5;
  const normalizedLocation = normalizeMatchText(location);
  if (normalizedLocation && normalizedLocation.split(/\s+/).filter((token) => token.length >= 3).some((token) => body.includes(token))) score += 1;
  return score;
}

function extractPhoneCandidates(value: string) {
  const phones = new Set<string>();
  const add = (raw: string) => { const cleaned = raw.replace(/&nbsp;/gi, " ").replace(/&#43;/gi, "+").replace(/\s+/g, " ").trim(); const digits = cleaned.replace(/\D/g, ""); if (digits.length >= 7 && digits.length <= 15) phones.add(cleaned); };
  const patterns = [
    /(?:tel:|phone(?:\s*number)?|telephone|mobile|call|whatsapp)\s*[:=]?\s*([+\d][\d\s().-]{6,18}\d)/gi,
    /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\+?\d{7,15})/gi,
    /\+\d{1,3}[\s().-]?(?:\d[\s().-]?){7,14}\d/g,
    /(?:^|[^\d])(?:0\d[\s().-]?){6,12}\d(?:$|[^\d])/gm,
  ];
  for (const pattern of patterns) { let match: RegExpExecArray | null; while ((match = pattern.exec(value)) !== null) { add(match[1] ?? match[0]); if (!pattern.global) break; } }
  return Array.from(phones).filter((phone) => phone.replace(/\D/g, "").length <= 15).slice(0, 8);
}

function bestPhoneFromSearchResults(items: Array<{ title: string; url: string; snippet?: string }>, business: NormalizedBusiness, location: string) {
  const ranked = items
    .map((item) => ({ item, relevance: searchResultRelevance(item, business, location), phones: extractPhoneCandidates(`${item.title}\n${item.snippet ?? ""}\n${item.url}`) }))
    .filter((entry) => entry.relevance >= 5 && entry.phones.length > 0)
    .sort((a, b) => b.relevance - a.relevance);
  if (!ranked.length) return undefined;
  const candidates = ranked.flatMap(({ phones, relevance }) => phones.map((phone) => ({ phone, relevance })));
  return candidates.sort((a, b) => { const aInternational = a.phone.startsWith("+") ? 1 : 0; const bInternational = b.phone.startsWith("+") ? 1 : 0; return b.relevance - a.relevance || bInternational - aInternational || b.phone.replace(/\D/g, "").length - a.phone.replace(/\D/g, "").length; })[0]?.phone;
}

async function recoverMissingPhones(clusters: DiscoveryCluster[], query: DiscoveryQuery) {
  if (!process.env.TAVILY_API_KEY?.trim() && !process.env.EXA_API_KEY?.trim()) return clusters;
  const maxQueries = Math.max(1, Number(process.env.MAX_PHONE_RECOVERY_QUERIES) || (query.depth === "deep" ? 40 : query.depth === "standard" ? 20 : 5));
  let queries = 0;
  const recovered: DiscoveryCluster[] = [];
  for (const cluster of clusters) {
    if (queries >= maxQueries) break;
    if (cluster.canonical.phone) { recovered.push(cluster); continue; }
    const business = cluster.canonical;
    const location = [business.city ?? query.city, business.region ?? query.region, business.country ?? query.country].filter(Boolean).join(", ");
    try {
      const result = await searchEvidence({ businessName: business.name, category: business.category ?? query.category, country: business.country ?? query.country, location, limit: 10, query: `"${business.name}" ${location} phone telephone contact WhatsApp` }, "both");
      queries += 1;
      const phone = bestPhoneFromSearchResults(result.results.flatMap((item) => item.results), business, location);
      if (phone) cluster.canonical = { ...business, phone };
    } catch { queries += 1; }
    recovered.push(cluster);
  }
  for (const cluster of clusters.slice(recovered.length)) recovered.push(cluster);
  return recovered;
}

async function finalizeClusters(clusters: DiscoveryCluster[], query: DiscoveryQuery) {
  const maxRecoveryCandidates = Math.min(clusters.length, Math.max(query.limit * 2, query.depth === "deep" ? 40 : query.depth === "standard" ? 20 : 5));
  const recovered = await recoverMissingPhones(clusters.slice(0, maxRecoveryCandidates), query);
  return rankClusters(recovered, query.limit);
}

export async function runBusinessDiscovery(query: DiscoveryQuery, options: RouterOptions): Promise<DiscoveryRunResult> {
  const primaryProvider = options.primary ?? "foursquare";
  const fallbackProvider: DiscoverySource = primaryProvider === "foursquare" ? "yelp" : "foursquare";
  const providers: Record<DiscoverySource, ProviderSummary> = { foursquare: { status: "not-queried", count: 0, queried: false }, yelp: { status: "not-queried", count: 0, queried: false } };
  if (options.mode === "multi-source") { const [foursquare, yelp] = await Promise.all([queryProvider("foursquare", query), queryProvider("yelp", query)]); providers.foursquare = buildProviderSummary(foursquare); providers.yelp = buildProviderSummary(yelp); const combined = mergeResults([foursquare, yelp]); const ranked = await finalizeClusters(combined.clusters, query); return { clusters: ranked, results: ranked.map((cluster) => cluster.canonical), resultSources: ranked.map(clusterSources), totalUniqueResults: ranked.length, providers, queriedProviders: ["foursquare", "yelp"], fallbackUsed: false, mode: options.mode, requestedProvider: options.requestedProvider ?? "both" }; }
  const primary = await queryProvider(primaryProvider, query); providers[primaryProvider] = buildProviderSummary(primary);
  if (options.allowFallback && primary.results.length < query.limit) { const fallback = await queryProvider(fallbackProvider, query); providers[fallbackProvider] = buildProviderSummary(fallback); const combined = mergeResults([primary, fallback]); const ranked = await finalizeClusters(combined.clusters, query); return { clusters: ranked, results: ranked.map((cluster) => cluster.canonical), resultSources: ranked.map(clusterSources), totalUniqueResults: ranked.length, providers, queriedProviders: [primaryProvider, fallbackProvider], fallbackUsed: true, mode: options.mode, requestedProvider: options.requestedProvider ?? "best-available" }; }
  const combined = mergeResults([primary]); const ranked = await finalizeClusters(combined.clusters, query); return { clusters: ranked, results: ranked.map((cluster) => cluster.canonical), resultSources: ranked.map(clusterSources), totalUniqueResults: ranked.length, providers, queriedProviders: [primaryProvider], fallbackUsed: false, mode: options.mode, requestedProvider: options.requestedProvider ?? (options.allowFallback ? "best-available" : primaryProvider) };
}
