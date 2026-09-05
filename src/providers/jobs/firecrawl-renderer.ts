import { isAllowedByRobots } from "./robots";
import type { JobSearchQuery, NormalizedJob } from "./types";

const TIMEOUT_MS = Math.max(5_000, Number(process.env.JOB_FIRECRAWL_TIMEOUT_MS) || 20_000);
const MAX_URLS = Math.max(4, Math.min(Number(process.env.JOB_FIRECRAWL_RENDER_PAGES) || 10, 20));

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clean(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function host(value?: string) {
  try { return value ? new URL(value).hostname.toLowerCase().replace(/^www\./, "") : undefined; } catch { return undefined; }
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function titleMatches(title: string, query: JobSearchQuery) {
  const terms = normalize(query.title).split(" ").filter((term) => term.length > 2);
  if (!terms.length) return true;
  const candidate = normalize(title);
  return terms.filter((term) => candidate.includes(term)).length >= Math.max(1, Math.ceil(terms.length * 0.45));
}

function stableId(urlValue: string, title: string, company: string) {
  return `firecrawl:${normalize(`${urlValue}|${title}|${company}`).slice(0, 220)}`;
}

function jsonLd(html: string) {
  const items: Record<string, unknown>[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        if (item && typeof item === "object") items.push(item as Record<string, unknown>);
      }
    } catch {}
  }
  return items;
}

function fromHtml(html: string, urlValue: string, query: JobSearchQuery): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  for (const item of jsonLd(html)) {
    const type = item["@type"];
    if (!(type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting")))) continue;
    const title = text(item.title);
    const company = text((item.hiringOrganization as any)?.name ?? item.hiringOrganization);
    if (!title || !company || !titleMatches(title, query)) continue;
    const employer = text((item.hiringOrganization as any)?.url ?? (item.hiringOrganization as any)?.sameAs);
    const employerUrl = employer ? new URL(employer, urlValue).toString() : undefined;
    const applyUrl = text(item.url) ? new URL(String(item.url), urlValue).toString() : urlValue;
    const address = (item.jobLocation as any)?.address;
    jobs.push({
      id: stableId(applyUrl, title, company),
      provider: "web_discovery",
      title,
      companyName: company,
      companyWebsite: employerUrl,
      companyDomain: host(employerUrl),
      description: clean(text(item.description) ?? ""),
      location: clean([address?.addressLocality, address?.addressRegion, address?.addressCountry?.name ?? address?.addressCountry].filter(Boolean).join(", ")) || undefined,
      countryCode: text(address?.addressCountry?.name ?? address?.addressCountry)?.match(/^[A-Za-z]{2}$/)?.[0]?.toUpperCase() ?? query.countryCode?.toUpperCase(),
      employmentType: text(item.employmentType),
      remote: /telecommute|remote/i.test(JSON.stringify(item.jobLocationType ?? item.jobLocation ?? "")),
      postedAt: text(item.datePosted),
      applyUrl,
      sourceUrl: urlValue,
      sourceName: "Vantage intelligence",
      requirements: [],
      verificationStatus: "unverified",
      verificationReasons: [
        "Rendered job page extracted through Vantage's Firecrawl research layer.",
        "Employer ownership and application destination still require independent verification.",
      ],
      verificationEvidence: [{ url: urlValue, reason: "Rendered public job-page evidence." }],
    });
  }
  return jobs;
}

async function scrape(urlValue: string) {
  const key = text(process.env.FIRECRAWL_API_KEY);
  if (!key || !(await isAllowedByRobots(urlValue))) return undefined;
  const endpoint = text(process.env.FIRECRAWL_SCRAPE_URL) ?? "https://api.firecrawl.dev/v2/scrape";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url: urlValue, formats: ["html", "markdown"] }),
    });
    if (!response.ok) return undefined;
    const payload = await response.json() as any;
    const data = payload?.data ?? payload;
    return text(data?.html) ?? text(data?.rawHtml) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function renderJobPages(urls: string[], query: JobSearchQuery) {
  const candidates = Array.from(new Set(urls.filter(Boolean))).slice(0, MAX_URLS);
  if (!text(process.env.FIRECRAWL_API_KEY) || !candidates.length) return [];
  const pages = await Promise.all(candidates.map(async (urlValue) => ({ url: urlValue, html: await scrape(urlValue) })));
  return pages.flatMap(({ url, html }) => html ? fromHtml(html, url, query) : []);
}
