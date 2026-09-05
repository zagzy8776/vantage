import type { JobSearchQuery, NormalizedJob, RegionalJobProvider } from "./types";
import { isAllowedByRobots } from "./robots";
import { regionalSourceEnabled, sourceDefinition } from "./source-registry";

export interface RegionalEngineResult {
  provider: RegionalJobProvider;
  status: "success" | "zero-results" | "unavailable" | "rate-limited" | "invalid-request" | "failed";
  jobs: NormalizedJob[];
  totalCount?: number;
  nextCursor?: string;
  hasMore?: boolean;
  errorMessage?: string;
  acquisition?: string[];
  webCrawlEnabled?: boolean;
}

const TIMEOUT_MS = Math.max(2_000, Number(process.env.JOB_SCRAPER_TIMEOUT_MS) || 10_000);
const MAX_DETAIL = Math.max(1, Math.min(Number(process.env.JOB_SCRAPER_DETAIL_PAGES) || 12, 30));
const MAX_FEEDS = Math.max(1, Math.min(Number(process.env.JOB_MAX_DISCOVERED_FEEDS) || 8, 20));

function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function strip(value: string) { return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim(); }
function url(value?: string, base?: string) { try { const u = new URL(value ?? "", base); if (!["http:", "https:"].includes(u.protocol)) return undefined; u.hash = ""; return u.toString(); } catch { return undefined; } }
function host(value?: string) { try { return value ? new URL(value).hostname.toLowerCase().replace(/^www\./, "") : undefined; } catch { return undefined; } }
function sameOrigin(left: string, right: string) { return host(left) === host(right); }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function titleMatches(title: string, query: string) { const terms = normalize(query).split(" ").filter((v) => v.length > 2); if (!terms.length) return true; const candidate = normalize(title); return terms.some((term) => candidate.includes(term)); }
function locationMatches(location: string | undefined, query: JobSearchQuery) { if (!query.city?.trim()) return true; return normalize(location ?? "").includes(normalize(query.city)); }
function postedMatches(value: string | undefined, query: JobSearchQuery) { if (!query.postedWithinDays || !value) return true; const time = new Date(value).getTime(); if (!Number.isFinite(time)) return true; const maxAge = query.postedWithinDays * 86_400_000; return Date.now() - time <= maxAge; }
function jobMatchesQuery(job: NormalizedJob, query: JobSearchQuery) { if (!titleMatches(job.title, query.title)) return false; if (!locationMatches(job.location, query)) return false; if (query.remote === true && job.remote !== true) return false; return postedMatches(job.postedAt, query); }
function stableId(provider: RegionalJobProvider, sourceUrl: string, title: string, company: string) { return `${provider}:${normalize(`${sourceUrl}|${title}|${company}`).slice(0, 220)}`; }

function jsonLd(html: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) if (item && typeof item === "object") result.push(item as Record<string, unknown>);
    } catch {}
  }
  return result;
}

function locationValue(value: unknown) {
  const items = Array.isArray(value) ? value : [value];
  const locations = items.map((item: any) => [item?.address?.addressLocality, item?.address?.addressRegion, typeof item?.address?.addressCountry === "object" ? item.address.addressCountry?.name : item?.address?.addressCountry, item?.name].filter(Boolean).join(", ")).filter(Boolean);
  return locations.join(" | ") || (typeof value === "string" ? value : undefined);
}

function salary(item: Record<string, unknown>) {
  const base = item.baseSalary as Record<string, unknown> | undefined;
  const value = base?.value as Record<string, unknown> | number | string | undefined;
  const currency = text(base?.currency) ?? text((base?.value as any)?.currency);
  if (!base || value == null) return { currency: undefined, min: undefined, max: undefined };
  if (typeof value === "number") return { currency, min: value, max: value };
  if (typeof value === "string" && Number.isFinite(Number(value))) return { currency, min: Number(value), max: Number(value) };
  if (typeof value === "object") {
    const min = typeof value?.minValue === "number" ? value.minValue : typeof value?.minValue === "string" ? Number(value.minValue) : undefined;
    const max = typeof value?.maxValue === "number" ? value.maxValue : typeof value?.maxValue === "string" ? Number(value.maxValue) : undefined;
    return { currency, min: Number.isFinite(min) ? min : undefined, max: Number.isFinite(max) ? max : undefined };
  }
  return { currency, min: undefined, max: undefined };
}

function fromJobPosting(item: Record<string, unknown>, provider: RegionalJobProvider, sourceName: string, sourceUrl: string): NormalizedJob | undefined {
  const type = item["@type"];
  if (!(type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting")))) return undefined;
  const title = text(item.title); const org = item.hiringOrganization as Record<string, unknown> | undefined; const companyName = text(org?.name) ?? text(item.hiringOrganization); if (!title || !companyName) return undefined;
  const employerWebsite = url(text(org?.url) ?? text(org?.sameAs), sourceUrl); const applicationUrl = url(text(item.url), sourceUrl); const location = locationValue(item.jobLocation); const countryRaw = Array.isArray(item.jobLocation) ? undefined : text((item.jobLocation as any)?.address?.addressCountry); const postedAt = text(item.datePosted); const wages = salary(item);
  return { id: stableId(provider, applicationUrl ?? sourceUrl, title, companyName), provider, title, companyName, companyWebsite: employerWebsite, companyDomain: host(employerWebsite), description: strip(text(item.description) ?? ""), location, countryCode: countryRaw?.length === 2 ? countryRaw.toUpperCase() : undefined, employmentType: text(item.employmentType), remote: /telecommute|remote/i.test(JSON.stringify(item.jobLocationType ?? item.jobLocation ?? "")), postedAt, salaryMin: wages.min, salaryMax: wages.max, salaryCurrency: wages.currency, applyUrl: applicationUrl, sourceUrl, sourceName, requirements: [], verificationStatus: "unverified", verificationReasons: [`Discovered from ${sourceName}. Publisher provenance is retained; employer verification is performed separately.`], verificationEvidence: [{ url: sourceUrl, reason: `Public ${sourceName} listing/feed evidence.` }] };
}

function feedItems(xml: string, provider: RegionalJobProvider, sourceName: string, feedUrl: string, query: JobSearchQuery) {
  const jobs: NormalizedJob[] = [];
  for (const match of xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)) {
    const item = match[0]; const title = strip(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""); const link = url(item.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? item.match(/<link[^>]*>([^<]+)<\/link>/i)?.[1], feedUrl); if (!title || !link || !titleMatches(title, query.title)) continue;
    const description = strip(item.match(/<(?:description|summary|content:encoded)[^>]*>([\s\S]*?)<\/(?:description|summary|content:encoded)>/i)?.[1] ?? ""); const rawDate = strip(item.match(/<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i)?.[1] ?? ""); const creator = strip(item.match(/<(?:dc:creator|author)[^>]*>([\s\S]*?)<\/(?:dc:creator|author)>/i)?.[1] ?? ""); const parsedDate = rawDate ? new Date(rawDate) : undefined;
    const job: NormalizedJob = { id: stableId(provider, link, title, creator || "unknown"), provider, title, companyName: creator || "Unknown employer", description, sourceUrl: link, sourceName: `${sourceName} feed`, postedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : undefined, countryCode: query.countryCode?.toUpperCase(), requirements: [], verificationStatus: "unverified", verificationReasons: [`Collected from ${sourceName} public feed. Employer identity and application path remain independently unverified.`], verificationEvidence: [{ url: feedUrl, reason: `Public ${sourceName} feed evidence.` }] };
    if (jobMatchesQuery(job, query)) jobs.push(job); if (jobs.length >= (query.limit ?? 50)) break;
  }
  return jobs;
}

async function fetchText(target: string) { if (!(await isAllowedByRobots(target))) throw new Error("ROBOTS_DISALLOWED"); const response = await fetch(target, { cache: "no-store", redirect: "follow", headers: { Accept: "text/html,application/xhtml+xml,application/xml,application/rss+xml,text/xml;q=0.9,*/*;q=0.5", "User-Agent": "VantageJobsBot/1.0" }, signal: AbortSignal.timeout(TIMEOUT_MS) }); if (!response.ok) throw new Error(`HTTP_${response.status}`); return { body: await response.text(), url: response.url || target, contentType: response.headers.get("content-type") ?? "" }; }
function discoverFeedUrls(html: string, pageUrl: string) { const feeds = new Set<string>(); for (const match of html.matchAll(/<link[^>]+(?:type=["'](?:application\/(?:rss\+xml|atom\+xml)|text\/xml)["'][^>]+href=["']([^"']+)["']|href=["']([^"']+)["'][^>]+type=["'](?:application\/(?:rss\+xml|atom\+xml)|text\/xml)["'])[^>]*>/gi)) { const found = url(match[1] ?? match[2], pageUrl); if (found && sameOrigin(found, pageUrl)) feeds.add(found); } for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) { const found = url(match[1], pageUrl); if (found && sameOrigin(found, pageUrl) && /(?:rss|atom|feed|xml)(?:$|[?#/])/i.test(found)) feeds.add(found); } return [...feeds].slice(0, MAX_FEEDS); }
function candidateLinks(html: string, base: string, query: JobSearchQuery) { const links = new Set<string>(); for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) { const found = url(match[1], base); const label = strip(match[2] ?? ""); if (!found || !label || !titleMatches(label, query.title) || !sameOrigin(found, base)) continue; if (!/(job|career|vacanc|opening|opportunit|position|role)/i.test(`${label} ${found}`)) continue; if (/(login|signup|register|privacy|terms|contact|about|social)/i.test(found)) continue; links.add(found); if (links.size >= MAX_DETAIL) break; } return [...links]; }

function dedupe(jobs: NormalizedJob[], limit: number) { const map = new Map<string, NormalizedJob>(); for (const job of jobs) { const key = `${normalize(job.title)}|${normalize(job.companyName)}|${normalize(job.location ?? "")}`; const current = map.get(key); if (!current) { map.set(key, job); continue; } map.set(key, { ...current, description: (job.description?.length ?? 0) > (current.description?.length ?? 0) ? job.description : current.description, companyWebsite: current.companyWebsite ?? job.companyWebsite, companyDomain: current.companyDomain ?? job.companyDomain, applyUrl: current.applyUrl ?? job.applyUrl, postedAt: current.postedAt ?? job.postedAt, salaryMin: current.salaryMin ?? job.salaryMin, salaryMax: current.salaryMax ?? job.salaryMax, salaryCurrency: current.salaryCurrency ?? job.salaryCurrency, verificationReasons: Array.from(new Set([...current.verificationReasons, ...job.verificationReasons])), verificationEvidence: Array.from(new Map([...(current.verificationEvidence ?? []), ...(job.verificationEvidence ?? [])].map((e) => [e.url, e])).values()).slice(0, 12) }); } return [...map.values()].slice(0, limit); }

export async function crawlRegionalSource(provider: RegionalJobProvider, query: JobSearchQuery): Promise<RegionalEngineResult> {
  const source = sourceDefinition(provider); if (!source) return { provider, status: "unavailable", jobs: [], errorMessage: "Regional source is not registered." };
  if (!source.countries.includes((query.countryCode ?? "NG").toUpperCase())) return { provider, status: "zero-results", jobs: [] };
  if (!regionalSourceEnabled(source)) return { provider, status: "unavailable", jobs: [], acquisition: source.acquisition, webCrawlEnabled: false, errorMessage: "Web collection is disabled for this source until VANTAGE_ENABLE_REGIONAL_WEB_CRAWL is enabled." };

  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100); const collected: NormalizedJob[] = [];
  const feedSeeds = [...(source.explicitFeedUrls ?? []), ...(source.feedDiscoveryUrls ?? [])];
  for (const seed of feedSeeds) {
    try { const fetched = await fetchText(seed); const discovered = /html/i.test(fetched.contentType) || /<(?:html|body|head)\b/i.test(fetched.body) ? discoverFeedUrls(fetched.body, fetched.url) : []; const candidates = /xml|rss|atom/i.test(fetched.contentType) ? [fetched.url] : discovered; for (const feed of candidates.slice(0, MAX_FEEDS)) { try { const body = feed === fetched.url ? fetched.body : (await fetchText(feed)).body; collected.push(...feedItems(body, provider, source.name, feed, query)); } catch {} } if (collected.length >= limit) break; } catch {}
  }

  if (source.acquisition.includes("public_web") && (source.requiresWebCrawlOptIn === false || /^(1|true|yes)$/i.test(process.env.VANTAGE_ENABLE_REGIONAL_WEB_CRAWL?.trim() ?? ""))) {
    for (const seed of source.seedUrls) {
      try { const page = await fetchText(seed); for (const item of jsonLd(page.body)) { const job = fromJobPosting(item, provider, source.name, page.url); if (job && jobMatchesQuery(job, query)) collected.push(job); } const links = candidateLinks(page.body, page.url, query); const details = await Promise.all(links.map(async (link) => { try { return await fetchText(link); } catch { return null; } })); for (let i = 0; i < details.length; i += 1) { const detail = details[i]; if (!detail) continue; for (const item of jsonLd(detail.body)) { const job = fromJobPosting(item, provider, source.name, detail.url); if (job && jobMatchesQuery(job, query)) collected.push(job); } } } catch {} if (collected.length >= limit) break;
    }
  }

  const jobs = dedupe(collected, limit); const webCrawlEnabled = /^(1|true|yes)$/i.test(process.env.VANTAGE_ENABLE_REGIONAL_WEB_CRAWL?.trim() ?? "");
  return { provider, status: jobs.length ? "success" : "zero-results", jobs, totalCount: jobs.length, hasMore: false, acquisition: source.acquisition, webCrawlEnabled };
}
