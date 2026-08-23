export interface NormalizedCountry {
  countryCode?: string;
  countryName: string;
}

export interface NormalizedGeography extends NormalizedCountry {
  region?: string;
  city?: string;
  area?: string;
  street?: string;
}

interface CountryDefinition {
  code: string;
  name: string;
  aliases: string[];
}

// Keep this table explicit and extensible. Unknown country names are preserved
// as names, but are never guessed into country codes.
const COUNTRY_DEFINITIONS: CountryDefinition[] = [
  { code: "CA", name: "Canada", aliases: ["ca", "canada"] },
  { code: "NG", name: "Nigeria", aliases: ["ng", "nigeria"] },
  { code: "FR", name: "France", aliases: ["fr", "france"] },
  { code: "DE", name: "Germany", aliases: ["de", "germany", "deutschland"] },
  { code: "US", name: "United States", aliases: ["us", "usa", "united states", "united states of america"] },
  { code: "GB", name: "United Kingdom", aliases: ["gb", "uk", "united kingdom", "great britain", "england"] },
  { code: "AU", name: "Australia", aliases: ["au", "australia"] },
  { code: "IN", name: "India", aliases: ["in", "india"] },
  { code: "IT", name: "Italy", aliases: ["it", "italy"] },
  { code: "ES", name: "Spain", aliases: ["es", "spain"] },
  { code: "BR", name: "Brazil", aliases: ["br", "brazil"] },
  { code: "MX", name: "Mexico", aliases: ["mx", "mexico"] },
  { code: "JP", name: "Japan", aliases: ["jp", "japan"] },
  { code: "AE", name: "United Arab Emirates", aliases: ["ae", "uae", "united arab emirates"] },
  { code: "ZA", name: "South Africa", aliases: ["za", "south africa"] },
];

const COUNTRY_BY_ALIAS = new Map(COUNTRY_DEFINITIONS.flatMap((definition) => definition.aliases.map((alias) => [alias, definition] as const)));

const CITY_REGION_DEFINITIONS: Record<string, string> = {
  "ca|toronto": "Ontario",
  "fr|paris": "Île-de-France",
  "de|berlin": "Berlin",
  "us|new york": "New York",
};

const REGION_ALIASES: Record<string, string> = {
  on: "Ontario",
  qc: "Quebec",
  bc: "British Columbia",
  ab: "Alberta",
  ns: "Nova Scotia",
  ny: "New York",
  ca: "California",
  il: "Illinois",
  tx: "Texas",
  be: "Berlin",
};

export function normalizeCountry(value?: string): NormalizedCountry | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const definition = COUNTRY_BY_ALIAS.get(trimmed.toLowerCase());
  return definition ? { countryCode: definition.code, countryName: definition.name } : { countryName: trimmed };
}

export function normalizeGeography(input: { country?: string; countryCode?: string; countryName?: string; region?: string; city?: string; area?: string; street?: string }): NormalizedGeography | undefined {
  const country = normalizeCountry(input.countryName ?? input.countryCode ?? input.country);
  if (!country) return undefined;
  const regionInput = input.region?.trim();
  const region = regionInput ? normalizeRegion(regionInput) : (input.city ? CITY_REGION_DEFINITIONS[`${country.countryCode?.toLowerCase() ?? ""}|${input.city.trim().toLowerCase()}`] : undefined);
  return {
    ...country,
    region,
    city: input.city?.trim() || undefined,
    area: input.area?.trim() || undefined,
    street: input.street?.trim() || undefined,
  };
}

export function normalizeRegion(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? REGION_ALIASES[trimmed.toLowerCase()] ?? trimmed : undefined;
}

export function countryNameForQuery(countryCode?: string, countryName?: string, fallback?: string) {
  return countryName ?? normalizeCountry(countryCode ?? fallback)?.countryName ?? fallback;
}