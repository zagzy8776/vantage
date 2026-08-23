import type { DiscoveryQuery } from "@/providers/business/types";
import type { DiscoverySourceSelection } from "@/lib/types";
import { normalizeGeography } from "@/lib/geography";

export interface DiscoveryQueryInput {
  category?: unknown;
  country?: unknown;
  region?: unknown;
  city?: unknown;
  countryCode?: unknown;
  countryName?: unknown;
  area?: unknown;
  street?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  limit?: unknown;
  maxResults?: unknown;
  depth?: unknown;
  searchSource?: unknown;
  queryExpansion?: unknown;
  evidenceEnrichment?: unknown;
  webDiscoveryProvider?: unknown;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  query?: DiscoveryQuery;
}

function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function validateDiscoveryQuery(input: DiscoveryQueryInput): ValidationResult {
  const errors: string[] = [];
  const category = toTrimmedString(input.category);
  const countryInput = toTrimmedString(input.country);
  const region = toTrimmedString(input.region);
  const city = toTrimmedString(input.city);
  const area = toTrimmedString(input.area);
  const street = toTrimmedString(input.street);
  const geography = normalizeGeography({
    country: countryInput,
    countryCode: toTrimmedString(input.countryCode),
    countryName: toTrimmedString(input.countryName),
    region,
    city,
    area,
    street,
  });
  const country = geography?.countryName;
  const latitude = parseOptionalNumber(input.latitude);
  const longitude = parseOptionalNumber(input.longitude);
  const limitRaw = parseOptionalNumber(input.limit ?? input.maxResults);
  const depth = input.depth === "quick" || input.depth === "standard" || input.depth === "deep" ? input.depth : "standard";
  const searchSource: DiscoverySourceSelection =
    input.searchSource === "foursquare" || input.searchSource === "yelp" || input.searchSource === "both" ? input.searchSource : "best-available";

  if (!category) errors.push("Business type is required.");
  if (!countryInput) errors.push("Country is required.");

  const limit = limitRaw ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
    errors.push("Limit must be an integer between 1 and 250.");
  }

  if ((latitude === undefined) !== (longitude === undefined)) {
    errors.push("Latitude and longitude must be provided together.");
  }

  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    errors.push("Latitude is out of range.");
  }

  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    errors.push("Longitude is out of range.");
  }

  if (errors.length > 0 || !category || !country) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors,
    query: {
      category,
      country,
      countryCode: geography?.countryCode,
      countryName: geography?.countryName,
      region: geography?.region,
      city: geography?.city,
      area: geography?.area,
      street: geography?.street,
      latitude,
      longitude,
      limit,
      depth,
      searchSource,
      queryExpansion: input.queryExpansion === true || input.queryExpansion === "true",
      evidenceEnrichment: input.evidenceEnrichment === true || input.evidenceEnrichment === "true",
      webDiscoveryProvider: input.webDiscoveryProvider === "tavily" || input.webDiscoveryProvider === "exa" || input.webDiscoveryProvider === "both" ? input.webDiscoveryProvider : "best-available",
    },
  };
}