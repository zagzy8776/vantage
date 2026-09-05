import type { JobSearchQuery, NormalizedJob, RegionalJobProvider } from "./types";
import { isAllowedByRobots } from "./robots";

export type NigeriaWebSource = {
  provider: RegionalJobProvider;
  name: string;
  country: "NG";
  seeds: string[];
  feedUrls?: string[];
};

export const NIGERIA_WEB_SOURCES: NigeriaWebSource[] = [
  {
    provider: "myjobmag",
    name: "MyJobMag Nigeria",
    country: "NG",
    seeds: ["https://www.myjobmag.com/"],
    feedUrls: [
      "https://www.myjobmag.com/jobsxml.xml",
      "https://www.myjobmag.com/jobsxml_by_categories.xml",
      "https://www.myjobmag.com/aggregate_feed.xml",
    ],
  },
  { provider: "jobberman", name: "Jobberman Nigeria", country: "NG", seeds: ["https://www.jobberman.com/jobs"] },
  { provider: "hotnigerianjobs", name: "Hot Nigerian Jobs", country: "NG", seeds: ["https://www.hotnigerianjobs.com/"] },
  { provider: "jobgurus", name: "Jobgurus", country: "NG", seeds: ["https://www.jobgurus.com.ng/"] },
  { provider: "jobsinnigeria", name: "Jobs In Nigeria", country: "NG", seeds: ["https://www.jobsinnigeria.ng/"] },
  { provider: "workinnigeria", name: "Work in Nigeria", country: "NG", seeds: ["https://workinnigeria.org/vacancy/"] },
];

const TIMEOUT_MS = Number(process.env.JOB_SCRAPER_TIMEOUT_MS) || 12_000;
const MAX_DETAIL_PAGES = Math.max(2, Math.min(Number(process.env.JOB_SCRAPER_DETAIL_PAGES) || 12, 30));

function cleanUrl(value?: string, base?: string) {
  try {
    const url = new URL(value ?? "", base);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}
function strip(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#x2F;/gi, "/").replace(/\s+/g, " ").trim();
}
function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function domain(value?: string) { const url = cleanUrl(value); return url ? url.hostname.toLowerCase().replace(/^www\./, "") : undefined; }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function queryMatches(title: string, query: string) {
  const terms = normalize(query).split(" ").filter((term) => term.length > 2);
  if (!terms.length) return true;
  const lower = normalize(title);
  return terms.some((term) => lower.includes(term));
}
function stableId(provider: RegionalJobProvider, url: string, title: string, company: string) {
  return `${provider}:${normalize(`${url}|${title}|${company}`).slice(0, 220)}`;
}
function evidence(source: string, url: string) { return [{ url, reason: `Public ${source} listing collected by Vantage.` }]; }
function parseJsonLd(html: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of values) if (item && typeof item === "object") result.push(item as Record<string, unknown>);
    } catch {}
  }
  return result;
}
function posting(item: Record<string, unknown>, source: NigeriaWebSource, url: string): NormalizedJob | null {
  const type = item["@type"];
  if (!(type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting")))) return null;
  const title = text(item.title);
  const org = item.hiringOrganization as Record<string, unknown> | undefined;
  const companyName = text(org?.name) ?? text(item.hiringOrganization);
  if (!title || !companyName) return null;
  const employerUrl = cleanUrl(text(org?.url) ?? text(org?.sameAs), url);
  const applicationUrl = cleanUrl(text(item.url), url);
  const location = (() => {
    const raw = Array.isArray(item.jobLocation) ? item.jobLocation[0] : item.jobLocation;
    if (!raw || typeof raw !== "object") return undefined;
    const address = (raw as any).address;
    return [address?.addressLocality, address?.addressRegion, typeof address?.addressCountry === "object" ? address.addressCountry?.name : address?.addressCountry].filter(Boolean).join(", ") || undefined;
  })();
  const posted = text(item.datePosted);
  const remote = text(item.jobLocationType) === "TELECOMMUTE" || /remote/i.test(JSON.stringify(item.jobLocation ?? ""));
  return {
    id: stableId(source.provider, applicationUrl ?? url, title, companyName),
    provider: source.provider,
    title,
    companyName,
    companyWebsite: employerUrl,
    companyDomain: domain(employerUrl),
    description: strip(text(item.description) ?? ""),
    location,
    countryCode: "NG",
    employmentType: text(item.employmentType),
    remote: remote || undefined,
    postedAt: posted,
    applyUrl: applicationUrl,
    sourceUrl: url,
    sourceName: source.name,
    requirements: [],
    verificationStatus: "unverified",
    verificationReasons: [`Discovered on ${source.name}; source provenance is evidence, not an employer verification.`],
    verificationEvidence: evidence(source.name, url),
  };
}
function parseFeed(xml: string, source: NigeriaWebSource, feedUrl: string, query: JobSearchQuery): NormalizedJob[] {
  const output: NormalizedJob[] = [];
  for (const match of xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)) {
    const item = match[0];
    const title = strip(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const link = cleanUrl(item.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? item.match(/<link[^>]*>([^<]+)<\/link>/i)?.[1], feedUrl);
    if (!title || !link || !queryMatches(title, query.title)) continue;
    const description = strip(item.match(/<(?:description|summary|content:encoded)[^>]*>([\s\S]*?)<\/(?:description|summary|content:encoded)>/i)?.[1] ?? "");
    const pub = strip(item.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i)?.[1] ?? "");
    output.push({
      id: stableId(source.provider, link, title, "unknown"), provider: source.provider, title, companyName: "Unknown employer", description,
      countryCode: "NG", sourceUrl: link, sourceName: `${source.name} feed`, postedAt: pub && !Number.isNaN(new Date(pub).getTime()) ? new Date(pub).toISOString() : undefined,
      requirements: [], verificationStatus: "unverified", verificationReasons: [`Collected from ${source.name} public feed; employer identity must be resolved independently.`], verificationEvidence: evidence(`${source.name} feed`, link),
    });
  }
  return output;
}
async function fetchPublic(url: string) {
  if (!(await isAllowedByRobots(url))) throw new Error("ROBOTS_DISALLOWED");
  const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "text/html,application/xhtml+xml,application/xml,application/rss+xml,text/xml;q=0.9,*/*;q=0.5", "User-Agent": "VantageJobsBot/1.0" } });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return { body: await response.text(), url: response.url || url };
}
function candidateLinks(html: string, base: string, query: JobSearchQuery) {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = cleanUrl(match[1], base); const label = strip(match[2] ?? ""); if (!url || !label || !queryMatches(label, query.title)) continue;
    const marker = `${label} ${url}`.toLowerCase();
    if (!/(job|career|vacanc|opening|opportunit|position|role)/i.test(marker)) continue;
    if (/login|signup|register|privacy|terms|facebook|twitter|instagram/i.test(url)) continue;
    links.add(url); if (links.size >= MAX_DETAIL_PAGES) break;
  }
  return [...links];
}

export async function scrapeNigeriaSource(provider: RegionalJobProvider, query: JobSearchQuery) {
  const source = NIGERIA_WEB_SOURCES.find((item) => item.provider === provider);
  if (!source || (query.countryCode ?? "NG").toUpperCase() !== "NG") return { provider, status: "zero-results" as const, jobs: [] as NormalizedJob[] };
  const jobs: NormalizedJob[] = [];
  for (const feed of source.feedUrls ?? []) {
    try { jobs.push(...parseFeed((await fetchPublic(feed)).body, source, feed, query)); } catch {}
  }
  for (const seed of source.seeds) {
    try {
      const page = await fetchPublic(seed);
      for (const item of parseJsonLd(page.body)) {
        const job = posting(item, source, page.url); if (job && queryMatches(job.title, query.title)) jobs.push(job);
      }
      const links = candidateLinks(page.body, page.url, query);
      const details = await Promise.all(links.map(async (url) => { try { return await fetchPublic(url); } catch { return null; } }));
      for (let i = 0; i < details.length; i += 1) {
        const detail = details[i]; if (!detail) continue;
        for (const item of parseJsonLd(detail.body)) {
          const job = posting(item, source, detail.url); if (job && queryMatches(job.title, query.title)) jobs.push(job);
        }
      }
    } catch {}
  }
  const deduped = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    const key = `${normalize(job.title)}|${normalize(job.companyName)}|${normalize(job.location ?? "")}`;
    const current = deduped.get(key);
    deduped.set(key, current ? { ...current, description: (job.description?.length ?? 0) > (current.description?.length ?? 0) ? job.description : current.description, companyWebsite: current.companyWebsite ?? job.companyWebsite, companyDomain: current.companyDomain ?? job.companyDomain, applyUrl: current.applyUrl ?? job.applyUrl, postedAt: current.postedAt ?? job.postedAt, verificationEvidence: [...(current.verificationEvidence ?? []), ...(job.verificationEvidence ?? [])].slice(0, 8) } : job);
  }
  const result = [...deduped.values()].slice(0, query.limit ?? 50);
  return { provider, status: result.length ? "success" as const : "zero-results" as const, jobs: result, totalCount: result.length, hasMore: false };
}
