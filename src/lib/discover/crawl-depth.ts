/** Central crawl depth knobs for discover + website research. */
export function websiteCrawlPageLimit(depth: string | undefined): number {
  const fromEnv = Number(process.env.MAX_RESEARCH_PAGES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  return depth === "deep" ? 12 : depth === "quick" ? 3 : 8;
}

export function firecrawlPageLimit(): number {
  const fromEnv = Number(process.env.MAX_FIRECRAWL_PAGES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  return 10;
}

export function maxBusinessesToEnrich(depth: string | undefined): number {
  const fromEnv = Number(process.env.MAX_ENRICHED_BUSINESSES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  return depth === "deep" ? 15 : 8;
}

/** Public website crawl on standard + deep (not quick-only discovery). */
export function shouldCrawlWebsites(depth: string | undefined): boolean {
  return depth !== "quick";
}
