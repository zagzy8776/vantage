/** Central crawl depth knobs for discover + website research. */

export function websiteCrawlPageLimit(depth: string | undefined): number {
  const fromEnv = Number(process.env.MAX_RESEARCH_PAGES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.min(40, Math.floor(fromEnv));
  // Higher caps so contact / booking / about pages are more likely to be hit.
  if (depth === "deep") return 24;
  if (depth === "quick") return 6;
  return 16; // standard
}

export function firecrawlPageLimit(): number {
  const fromEnv = Number(process.env.MAX_FIRECRAWL_PAGES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.min(40, Math.floor(fromEnv));
  return 20;
}

export function maxBusinessesToEnrich(depth: string | undefined): number {
  const fromEnv = Number(process.env.MAX_ENRICHED_BUSINESSES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.min(80, Math.floor(fromEnv));
  if (depth === "deep") return 40;
  if (depth === "quick") return 5;
  return 20; // standard
}

export function websiteCrawlTimeoutMs(depth: string | undefined): number {
  if (depth === "deep") return 45_000;
  if (depth === "quick") return 15_000;
  return 30_000;
}

/** Public website crawl on standard + deep (not quick-only discovery). */
export function shouldCrawlWebsites(depth: string | undefined): boolean {
  return depth !== "quick";
}
