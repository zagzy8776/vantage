import type { JobSearchQuery, RegionalJobProvider } from "./types";
import { REGIONAL_SOURCE_REGISTRY } from "./source-registry";
import { crawlRegionalSource, type RegionalEngineResult } from "./regional-source-engine";

export type RegionalSourceMode = "feed" | "web";
export type RegionalSource = (typeof REGIONAL_SOURCE_REGISTRY)[number];
export type RegionalJobProviderResult = RegionalEngineResult;

/** Backwards-compatible exports for callers that still import the old module. */
export const REGIONAL_JOB_SOURCES = REGIONAL_SOURCE_REGISTRY;

export async function scrapeRegionalSource(provider: RegionalJobProvider, query: JobSearchQuery): Promise<RegionalJobProviderResult> {
  return crawlRegionalSource(provider, query);
}
