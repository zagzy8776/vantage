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

const COUNTRY_DEFINITIONS: CountryDefinition[] = [
  { code: "US", name: "United States", aliases: ["us", "usa", "united states", "united states of america"] },
  { code: "CA", name: "Canada", aliases: ["ca", "canada"] },
  { code: "AU", name: "Australia", aliases: ["au", "australia"] },
  { code: "GB", name: "United Kingdom", aliases: ["gb", "uk", "united kingdom", "great britain", "england"] },
  { code: "PL", name: "Poland", aliases: ["pl", "poland", "polska"] },
  { code: "GH", name: "Ghana", aliases: ["gh", "ghana"] },
  { code: "FR", name: "France", aliases: ["fr", "france"] },
  { code: "DK", name: "Denmark", aliases: ["dk", "denmark", "danmark"] },
  { code: "IT", name: "Italy", aliases: ["it", "italy", "italia"] },
  { code: "CH", name: "Switzerland", aliases: ["ch", "switzerland", "schweiz", "suisse", "svizzera"] },
  { code: "DE", name: "Germany", aliases: ["de", "germany", "deutschland"] },
  { code: "NG", name: "Nigeria", aliases: ["ng", "nigeria"] },
  { code: "IN", name: "India", aliases: ["in", "india"] },
  { code: "ES", name: "Spain", aliases: ["es", "spain", "españa"] },
  { code: "BR", name: "Brazil", aliases: ["br", "brazil", "brasil"] },
  { code: "MX", name: "Mexico", aliases: ["mx", "mexico", "méxico"] },
  { code: "JP", name: "Japan", aliases: ["jp", "japan", "日本"] },
  { code: "AE", name: "United Arab Emirates", aliases: ["ae", "uae", "united arab emirates"] },
  { code: "ZA", name: "South Africa", aliases: ["za", "south africa"] },
];

const COUNTRY_BY_ALIAS = new Map(
  COUNTRY_DEFINITIONS.flatMap((definition) => definition.aliases.map((alias) => [alias, definition] as const)),
);

const CITY_REGION_DEFINITIONS: Record<string, string> = {
  "ca|toronto": "Ontario",
  "ca|vancouver": "British Columbia",
  "us|new york": "New York",
  "us|san francisco": "California",
  "fr|paris": "Île-de-France",
  "de|berlin": "Berlin",
  "gb|london": "Greater London",
  "au|sydney": "New South Wales",
  "pl|krakow": "Lesser Poland",
  "pl|kraków": "Lesser Poland",
  "gh|accra": "Greater Accra",
  "it|milan": "Lombardy",
  "ch|zurich": "Zurich",
  "dk|copenhagen": "Capital Region of Denmark",
  "ng|lagos": "Lagos",
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
  "greater accra": "Greater Accra",
  "greater london": "Greater London",
  nsw: "New South Wales",
  vic: "Victoria",
  wa: "Western Australia",
};

export function normalizeCountry(value?: string): NormalizedCountry | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const definition = COUNTRY_BY_ALIAS.get(trimmed.toLowerCase());
  return definition ? { countryCode: definition.code, countryName: definition.name } : { countryName: trimmed };
}

export function normalizeGeography(input: {
  country?: string;
  countryCode?: string;
  countryName?: string;
  region?: string;
  city?: string;
  area?: string;
  street?: string;
}): NormalizedGeography | undefined {
  const country = normalizeCountry(input.countryName ?? input.countryCode ?? input.country);
  if (!country) return undefined;

  const cityKey = input.city?.trim().toLowerCase();
  const regionInput = input.region?.trim();
  const region = regionInput
    ? normalizeRegion(regionInput)
    : cityKey
      ? CITY_REGION_DEFINITIONS[`${country.countryCode?.toLowerCase() ?? ""}|${cityKey}`]
      : undefined;

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
