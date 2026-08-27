/** Central crawl depth knobs for discover + website research. */

export function websiteCrawlPageLimit(depth: string | undefined): number {
  const fromEnv = Number(process.env.MAX_RESEARCH_PAGES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.min(30, Math.floor(fromEnv));
  // Deeper by default so contact emails / booking pages are more likely to be hit.
  if (depth === "deep") return 20;
  if (depth === "quick") return 4;
  return 12; // standard
}

export function firecrawlPageLimit(): number {
  const fromEnv = Number(process.env.MAX_FIRECRAWL_PAGES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.min(30, Math.floor(fromEnv));
  return 15;
}

export function maxBusinessesToEnrich(depth: string | undefined): number {
  const fromEnv = Number(process.env.MAX_ENRICHED_BUSINESSES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.min(50, Math.floor(fromEnv));
  if (depth === "deep") return 25;
  if (depth === "quick") return 3;
  return 12; // standard
}

/** Public website crawl on standard + deep (not quick-only discovery). */
export function shouldCrawlWebsites(depth: string | undefined): boolean {
  return depth !== "quick";
}
