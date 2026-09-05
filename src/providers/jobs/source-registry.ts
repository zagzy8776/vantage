import type { RegionalJobProvider } from "./types";

export type JobSourceAcquisition = "licensed_api" | "licensed_feed" | "public_feed" | "public_web" | "company_careers";

export interface JobSourceDefinition {
  provider: RegionalJobProvider;
  name: string;
  countries: string[];
  acquisition: JobSourceAcquisition[];
  seedUrls: string[];
  feedDiscoveryUrls?: string[];
  explicitFeedUrls?: string[];
  aggregator?: boolean;
  requiresWebCrawlOptIn?: boolean;
  notes: string;
}

/**
 * Source registry is deliberately data-only. Collection policy lives here so
 * market routing cannot silently turn every discovered publisher into a scraper.
 */
export const REGIONAL_SOURCE_REGISTRY: JobSourceDefinition[] = [
  {
    provider: "myjobmag",
    name: "MyJobMag",
    countries: ["NG", "GH", "KE", "ZA"],
    acquisition: ["public_feed", "public_web"],
    seedUrls: ["https://www.myjobmag.com/"],
    feedDiscoveryUrls: ["https://www.myjobmag.com/feeds/"],
    aggregator: true,
    requiresWebCrawlOptIn: true,
    notes: "Prefer publisher feeds; public web crawl is opt-in and provenance-only.",
  },
  {
    provider: "jobberman",
    name: "Jobberman",
    countries: ["NG", "GH"],
    acquisition: ["public_web"],
    seedUrls: ["https://www.jobberman.com/jobs", "https://www.jobberman.com/"],
    aggregator: false,
    requiresWebCrawlOptIn: true,
    notes: "No public API is assumed; listing pages are discovery evidence only.",
  },
  {
    provider: "hotnigerianjobs",
    name: "Hot Nigerian Jobs",
    countries: ["NG"],
    acquisition: ["public_web"],
    seedUrls: ["https://www.hotnigerianjobs.com/"],
    requiresWebCrawlOptIn: true,
    notes: "Public Nigerian vacancy discovery surface.",
  },
  {
    provider: "jobgurus",
    name: "Jobgurus",
    countries: ["NG"],
    acquisition: ["public_feed", "public_web"],
    seedUrls: ["https://www.jobgurus.com.ng/"],
    aggregator: true,
    requiresWebCrawlOptIn: true,
    notes: "Prefer any publisher-provided feed before page collection.",
  },
  {
    provider: "jobsinnigeria",
    name: "Jobs In Nigeria",
    countries: ["NG"],
    acquisition: ["public_web"],
    seedUrls: ["https://www.jobsinnigeria.ng/"],
    requiresWebCrawlOptIn: true,
    notes: "Nigeria-focused discovery source.",
  },
  {
    provider: "workinnigeria",
    name: "Work in Nigeria",
    countries: ["NG"],
    acquisition: ["public_web"],
    seedUrls: ["https://workinnigeria.org/vacancy/"],
    requiresWebCrawlOptIn: true,
    notes: "Nigeria-focused vacancy archive.",
  },
  {
    provider: "fuzu",
    name: "Fuzu",
    countries: ["NG", "KE", "UG"],
    acquisition: ["public_web"],
    seedUrls: ["https://www.fuzu.com/nigeria/job", "https://www.fuzu.com/job"],
    requiresWebCrawlOptIn: true,
    notes: "Regional discovery source; preserve original listing provenance.",
  },
  {
    provider: "careerjet",
    name: "Careerjet",
    countries: ["NG", "GH", "KE", "ZA"],
    acquisition: ["public_web"],
    seedUrls: ["https://www.careerjet.com.ng/", "https://www.careerjet.co.za/"],
    aggregator: true,
    requiresWebCrawlOptIn: true,
    notes: "Aggregator only. It can corroborate discovery but never establish employer truth.",
  },
  {
    provider: "brightermonday",
    name: "BrighterMonday",
    countries: ["GH", "KE", "UG"],
    acquisition: ["public_web"],
    seedUrls: ["https://www.brightermonday.co.ke/", "https://www.brightermonday.co.ug/"],
    aggregator: false,
    requiresWebCrawlOptIn: true,
    notes: "Regional marketplace; preserve publisher provenance.",
  },
  {
    provider: "careers24",
    name: "Careers24",
    countries: ["ZA"],
    acquisition: ["public_web"],
    seedUrls: ["https://www.careers24.com/jobs"],
    requiresWebCrawlOptIn: true,
    notes: "South African discovery surface.",
  },
  {
    provider: "careerjunction",
    name: "CareerJunction",
    countries: ["ZA"],
    acquisition: ["public_web"],
    seedUrls: ["https://www.careerjunction.co.za/"],
    requiresWebCrawlOptIn: true,
    notes: "South African discovery surface.",
  },
  {
    provider: "pnet",
    name: "PNet",
    countries: ["ZA"],
    acquisition: ["public_web"],
    seedUrls: ["https://www.pnet.co.za/"],
    requiresWebCrawlOptIn: true,
    notes: "South African discovery surface.",
  },
];

export const MARKET_REGIONAL_PRIORITY: Record<string, RegionalJobProvider[]> = {
  NG: ["myjobmag", "jobberman", "hotnigerianjobs", "jobgurus", "jobsinnigeria", "workinnigeria", "fuzu", "careerjet"],
  GH: ["myjobmag", "jobberman", "fuzu", "brightermonday", "careerjet"],
  KE: ["myjobmag", "fuzu", "brightermonday", "careerjet"],
  UG: ["fuzu", "brightermonday"],
  ZA: ["myjobmag", "careerjet", "careers24", "careerjunction", "pnet"],
};

export function sourceDefinition(provider: RegionalJobProvider) {
  return REGIONAL_SOURCE_REGISTRY.find((source) => source.provider === provider);
}

export function regionalWebCrawlEnabled() {
  return /^(1|true|yes)$/i.test(process.env.VANTAGE_ENABLE_REGIONAL_WEB_CRAWL?.trim() ?? "");
}

export function regionalSourceEnabled(source: JobSourceDefinition) {
  if (source.acquisition.includes("licensed_api") || source.acquisition.includes("licensed_feed") || source.acquisition.includes("public_feed")) return true;
  return !source.requiresWebCrawlOptIn || regionalWebCrawlEnabled();
}
