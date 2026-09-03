import type { BusinessDiscoveryProvider, DiscoveryQuery, NormalizedBusiness, ProviderSearchResult } from "./types";
import { timeoutMs } from "@/lib/reliability/timeout";
import { countryNameForQuery, normalizeCountry, normalizeGeography, normalizeRegion } from "@/lib/geography";

type FoursquareSearchResponse = {
  results?: Array<{
    fsq_id?: string;
    fsq_place_id?: string;
    name?: string;
    categories?: Array<{ name?: string }>;
    location?: { address?: string; country?: string; region?: string; locality?: string; neighborhood?: Array<string>; postcode?: string; address_extended?: string; formatted_address?: string; cross_street?: string };
    geocodes?: { main?: { latitude?: number; longitude?: number } };
    contact?: { tel?: string; website?: string; email?: string };
    tel?: string;
    website?: string;
    email?: string;
    rating?: number;
    stats?: { total_ratings?: number };
    price?: number;
  }>;
};

type FoursquareVenue = NonNullable<FoursquareSearchResponse["results"]>[number];

const RETURN_FIELDS = ["fsq_id", "fsq_place_id", "name", "categories", "location", "geocodes", "tel", "contact", "website", "email", "rating", "stats", "price"].join(",");

export function buildFoursquareSearchParams(query: DiscoveryQuery) {
  const params = new URLSearchParams();
  const geography = normalizeGeography(query);
  params.set("query", query.category);
  params.set("limit", String(Math.min(50, Math.max(1, query.limit))));
  params.set("fields", RETURN_FIELDS);
  params.set("tel_format", "E164");

  const ll = query.latitude !== undefined && query.longitude !== undefined ? `${query.latitude},${query.longitude}` : undefined;
  if (ll) params.set("ll", ll);

  const regionParts = [geography?.area, geography?.city, geography?.region, countryNameForQuery(geography?.countryCode, geography?.countryName, query.country)].filter(Boolean).join(", ");
  if (regionParts && !ll) params.set("near", regionParts);

  params.set("sort", query.depth === "deep" ? "DISTANCE" : "RELEVANCE");
  return params;
}

function buildNearbyQuery(query: DiscoveryQuery) {
  const params = buildFoursquareSearchParams(query);
  console.info(JSON.stringify({ diagnostic: "foursquare_search_parameters", parameters: Object.fromEntries(params.entries()) }));
  return params;
}

function chooseStreet(location?: FoursquareVenue["location"], query?: DiscoveryQuery) {
  const street = location?.address_extended || location?.address || location?.cross_street;
  if (!query?.street) return street;
  if (street?.toLowerCase().includes(query.street.toLowerCase())) return street;
  return undefined;
}

function matchesRequestedLocation(query: DiscoveryQuery, location?: FoursquareVenue["location"]) {
  const normalized = (value?: string) => value?.trim().toLowerCase();
  const locationRegion = normalized(normalizeRegion(location?.region));
  const locationCity = normalized(location?.locality);
  const locationArea = normalized(location?.neighborhood?.[0]);
  const country = normalized(countryNameForQuery(query.countryCode, query.countryName, query.country));
  const locationCountryName = normalizeCountry(location?.country)?.countryName;
  const normalizedLocationCountry = normalized(locationCountryName ?? location?.country);
  const region = normalized(query.region);
  const city = normalized(query.city);
  const area = normalized(query.area);

  if (country && normalizedLocationCountry && !normalizedLocationCountry.includes(country) && !country.includes(normalizedLocationCountry)) return false;
  if (region && locationRegion && !locationRegion.includes(region) && !region.includes(locationRegion)) return false;
  if (city && locationCity && !locationCity.includes(city) && !city.includes(locationCity)) return false;
  if (area && locationArea && !locationArea.includes(area) && !area.includes(locationArea)) return false;
  return true;
}

function normalizeResult(result: FoursquareVenue, query: DiscoveryQuery): NormalizedBusiness | null {
  const lat = result.geocodes?.main?.latitude;
  const lng = result.geocodes?.main?.longitude;
  const location = result.location;
  const street = chooseStreet(location, query);
  if (!(result.fsq_place_id || result.fsq_id) || !result.name) return null;
  if (query.street && street === undefined) return null;

  return {
    externalId: result.fsq_place_id ?? result.fsq_id!,
    source: "foursquare",
    name: result.name,
    category: result.categories?.[0]?.name,
    address: location?.formatted_address || location?.address || location?.address_extended || undefined,
    country: normalizeCountry(location?.country)?.countryName ?? location?.country,
    countryCode: normalizeCountry(location?.country)?.countryCode,
    region: normalizeRegion(location?.region),
    city: location?.locality,
    area: location?.neighborhood?.[0],
    street,
    latitude: typeof lat === "number" ? lat : undefined,
    longitude: typeof lng === "number" ? lng : undefined,
    phone: result.tel ?? result.contact?.tel,
    website: result.website ?? result.contact?.website,
    rating: typeof result.rating === "number" ? result.rating : undefined,
    reviewCount: typeof result.stats?.total_ratings === "number" ? result.stats.total_ratings : undefined,
    priceLevel: typeof result.price === "number" ? result.price : undefined,
  };
}

export class FoursquareBusinessProvider implements BusinessDiscoveryProvider {
  name = "foursquare" as const;

  async search(query: DiscoveryQuery): Promise<ProviderSearchResult> {
    const apiKey = process.env.FOURSQUARE_API_KEY?.trim();
    if (!apiKey) return { provider: this.name, status: "unavailable", results: [], errorMessage: "FOURSQUARE_API_KEY is not configured." };
    try {
      const url = new URL("https://places-api.foursquare.com/places/search");
      const params = buildNearbyQuery(query);
      url.search = params.toString();
      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}`, "X-Places-Api-Version": "2025-06-17" },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs("BUSINESS_PROVIDER_TIMEOUT_MS", 20_000)),
      });
      if (response.status === 429) return { provider: this.name, status: "rate-limited", results: [], errorMessage: "Foursquare rate limit exceeded." };
      if (response.status === 401 || response.status === 403) return { provider: this.name, status: "failed", results: [], errorMessage: "Foursquare authentication failed." };
      if (response.status === 400) return { provider: this.name, status: "invalid-request", results: [], errorMessage: "Foursquare rejected the search request." };
      if (!response.ok) return { provider: this.name, status: "unexpected-response", results: [], errorMessage: `Foursquare request failed with status ${response.status}` };
      const data = (await response.json()) as FoursquareSearchResponse;
      if (!data || !Array.isArray(data.results)) return { provider: this.name, status: "unexpected-response", results: [], errorMessage: "Malformed Foursquare response." };
      const results = data.results.filter((result) => matchesRequestedLocation(query, result.location)).map((result) => normalizeResult(result, query)).filter((business): business is NormalizedBusiness => Boolean(business));
      return { provider: this.name, status: results.length ? "success" : "zero-results", results };
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      return { provider: this.name, status: timedOut ? "timeout" : "failed", results: [], errorMessage: timedOut ? "Foursquare request timed out." : "Foursquare request failed." };
    }
  }
}

export const foursquareBusinessProvider = new FoursquareBusinessProvider();