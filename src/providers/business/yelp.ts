import type { BusinessDiscoveryProvider, DiscoveryQuery, NormalizedBusiness, ProviderSearchResult } from "./types";
import { timeoutMs } from "@/lib/reliability/timeout";
import { countryNameForQuery, normalizeCountry, normalizeRegion } from "@/lib/geography";

type YelpBusiness = {
  id?: string;
  name?: string;
  categories?: Array<{ alias?: string; title?: string }>;
  coordinates?: { latitude?: number; longitude?: number };
  location?: {
    address1?: string;
    address2?: string;
    address3?: string;
    city?: string;
    state?: string;
    country?: string;
    zip_code?: string;
    display_address?: string[];
  };
  phone?: string;
  display_phone?: string;
  rating?: number;
  review_count?: number;
  price?: string;
  url?: string;
};

type YelpSearchResponse = { businesses?: YelpBusiness[]; total?: number };

function buildLocationTerm(query: DiscoveryQuery) {
  return [query.area, query.city, query.region, countryNameForQuery(query.countryCode, query.countryName, query.country)].filter(Boolean).join(", ");
}

function matchesRequestedLocation(query: DiscoveryQuery, business: YelpBusiness) {
  const normalized = (value?: string) => value?.trim().toLowerCase();
  const location = business.location;
  const country = normalized(countryNameForQuery(query.countryCode, query.countryName, query.country));
  const city = normalized(query.city);
  const region = normalized(query.region);
  const area = normalized(query.area);
  const locationCountry = normalized(normalizeCountry(location?.country)?.countryName ?? location?.country);
  const locationCity = normalized(location?.city);
  const locationRegion = normalized(normalizeRegion(location?.state));
  const address = normalized([location?.address1, location?.address2, location?.address3].filter(Boolean).join(" "));
  if (country && locationCountry && !locationCountry.includes(country) && !country.includes(locationCountry)) return false;
  if (city && locationCity && !locationCity.includes(city) && !city.includes(locationCity)) return false;
  if (region && locationRegion && !locationRegion.includes(region) && !region.includes(locationRegion)) return false;
  if (area && address && !address.includes(area)) return false;
  if (query.street && address && !address.includes(query.street.toLowerCase())) return false;
  return true;
}

function parsePrice(price?: string) {
  if (!price) return undefined;
  return price.length;
}

function normalizeResult(business: YelpBusiness): NormalizedBusiness | null {
  if (!business.id || !business.name) return null;
  return {
    externalId: business.id,
    source: "yelp",
    name: business.name,
    category: business.categories?.[0]?.title || business.categories?.[0]?.alias,
    address: business.location?.display_address?.join(", ") || [business.location?.address1, business.location?.address2, business.location?.address3].filter(Boolean).join(", ") || undefined,
    country: normalizeCountry(business.location?.country)?.countryName ?? business.location?.country,
    countryCode: normalizeCountry(business.location?.country)?.countryCode,
    region: normalizeRegion(business.location?.state),
    city: business.location?.city,
    street: business.location?.address1,
    latitude: typeof business.coordinates?.latitude === "number" ? business.coordinates.latitude : undefined,
    longitude: typeof business.coordinates?.longitude === "number" ? business.coordinates.longitude : undefined,
    phone: business.display_phone || business.phone,
    // Yelp's `url` is the directory listing, not the business's official website.
    website: undefined,
    rating: typeof business.rating === "number" ? business.rating : undefined,
    reviewCount: typeof business.review_count === "number" ? business.review_count : undefined,
    priceLevel: parsePrice(business.price),
  };
}

export class YelpBusinessProvider implements BusinessDiscoveryProvider {
  name = "yelp" as const;

  async search(query: DiscoveryQuery): Promise<ProviderSearchResult> {
    const apiKey = process.env.YELP_API_KEY?.trim();
    if (!apiKey) return { provider: this.name, status: "unavailable", results: [], errorMessage: "YELP_API_KEY is not configured." };
    const target = Math.min(240, Math.max(1, query.limit));
    const pageSize = Math.min(50, target);
    const maxOffset = Math.min(1000, Math.max(0, target - pageSize));
    const collected = new Map<string, NormalizedBusiness>();
    try {
      for (let offset = 0; offset <= maxOffset && collected.size < target; offset += 50) {
        const url = new URL("https://api.yelp.com/v3/businesses/search");
        url.searchParams.set("term", query.category);
        url.searchParams.set("limit", String(Math.min(pageSize, target - collected.size)));
        url.searchParams.set("offset", String(offset));
        const location = buildLocationTerm(query);
        if (location) url.searchParams.set("location", location);
        if (query.latitude !== undefined && query.longitude !== undefined) {
          url.searchParams.set("latitude", String(query.latitude));
          url.searchParams.set("longitude", String(query.longitude));
        }
        const response = await fetch(url.toString(), {
          headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs("BUSINESS_PROVIDER_TIMEOUT_MS", 20_000)),
        });
        const snapshot = () => Array.from(collected.values());
        if (response.status === 429) return { provider: this.name, status: collected.size ? "success" : "rate-limited", results: snapshot(), errorMessage: "Yelp rate limit exceeded." };
        if (response.status === 401 || response.status === 403) return { provider: this.name, status: "failed", results: snapshot(), errorMessage: "Yelp authentication failed." };
        if (response.status === 400) return { provider: this.name, status: "invalid-request", results: snapshot(), errorMessage: "Yelp rejected the search request." };
        if (!response.ok) return { provider: this.name, status: collected.size ? "success" : "unexpected-response", results: snapshot(), errorMessage: `Yelp request failed with status ${response.status}` };
        const data = (await response.json()) as YelpSearchResponse;
        if (!data || !Array.isArray(data.businesses)) return { provider: this.name, status: collected.size ? "success" : "unexpected-response", results: snapshot(), errorMessage: "Malformed Yelp response." };
        if (!data.businesses.length) break;
        for (const business of data.businesses) {
          if (!matchesRequestedLocation(query, business)) continue;
          const normalized = normalizeResult(business);
          if (normalized) collected.set(normalized.externalId, normalized);
        }
        if (data.businesses.length < pageSize) break;
      }
      const results = Array.from(collected.values()).slice(0, target);
      return { provider: this.name, status: results.length ? "success" : "zero-results", results };
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      const partial = Array.from(collected.values()).slice(0, target);
      return { provider: this.name, status: partial.length ? "success" : timedOut ? "timeout" : "failed", results: partial, errorMessage: timedOut ? "Yelp request timed out." : "Yelp request failed." };
    }
  }
}

export const yelpBusinessProvider = new YelpBusinessProvider();
