import { isAllowedByRobots } from "./robots";
import type { JobSearchQuery, NormalizedJob } from "./types";

const SEARCH_TIMEOUT_MS = Math.max(3_000, Number(process.env.JOB_DEEP_SEARCH_TIMEOUT_MS) || 12_000);
const MAX_RESULTS_PER_ENGINE = Math.max(4, Math.min(Number(process.env.JOB_DEEP_SEARCH_RESULTS) || 12, 30));
const MAX_CANDIDATES = Math.max(10, Math.min(Number(process.env.JOB_DEEP_MAX_CANDIDATES) || 40, 100));
const MAX_DETAIL_PAGES = Math.max(4, Math.min(Number(process.env.JOB_DEEP_DETAIL_PAGES) || 18, 40));

const ATS_HOSTS = new Set([
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "jobs.lever.co",
  "jobs.ashbyhq.com",
  "jobs.smartrecruiters.com",
  "workdayjobs.com",
  "myworkdayjobs.com",
  "icims.com",
  "bamboohr.com",
  "successfactors.com",
  "oraclecloud.com",
]);

const AFRICAN_SOURCES = [
  "myjobmag.com",
  "jobberman.com",
  "hotnigerianjobs.com",
  "jobgurus.com.ng",
  "jobsinnigeria.ng",
  "workinnigeria.org",
  "fuzu.com",
  "careerjet.com",
  "brightermonday.co.ke",
  "brightermonday.co.ug",
  "careers24.com",
  "careerjunction.co.za",
  "pnet.co.za",
  "careerlinkafrica.com",
  "jobsphere.net",
  "jobsearch.africa",
  "postkazi.com",
  "hiresasa.com",
  "talentpot.org",
  "worknation.africa",
  "closely.ng",
  "africajobline.com",
  "jobconnectafrica.com",
  "pac.africa",
];

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clean(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function host(value?: string) {
  try {
    return value ? new URL(value).hostname.toLowerCase().replace(/^www\./, "") : undefined;
  } catch {
    return undefined;
  }
}

function absoluteUrl(value: unknown, base?: string) {
  try {
    const candidate = new URL(String(value ?? ""), base);
    if (!["http:", "https:"].includes(candidate.protocol)) return undefined;
    candidate.hash = "";
    return candidate.toString();
  } catch {
    return undefined;
  }
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function queryTerms(query: JobSearchQuery) {
  return normalize(query.title).split(" ").filter((term) => term.length > 2);
}

function titleMatches(title: string, query: JobSearchQuery) {
  const terms = queryTerms(query);
  if (!terms.length) return true;
  const candidate = normalize(title);
  const hits = terms.filter((term) => candidate.includes(term)).length;
  return hits >= Math.max(1, Math.ceil(terms.length * 0.45));
}

function countryName(query: JobSearchQuery) {
  return text(query.country) ?? text(query.countryCode) ?? "Africa";
}

function isNoiseUrl(value: string) {
  const lower = value.toLowerCase();
  return /(?:facebook|instagram|tiktok|youtube|x\.com|twitter|linkedin\.com\/company|login|signup|register|privacy|terms|contact|about|cookie)/i.test(lower);
}

function isLikelyJobUrl(value: string) {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    return /(?:job|jobs|career|careers|vacanc|opening|position|role|opportunit|recruit|hiring|workday|greenhouse|lever|ashby|smartrecruiters)/i.test(pathname);
  } catch {
    return false;
  }
}

function isAtsUrl(value: string) {
  const current = host(value);
  if (!current) return false;
  return [...ATS_HOSTS].some((candidate) => current === candidate || current.endsWith(`.${candidate}`));
}

function sourceFromUrl(value: string) {
  const current = host(value);
  if (!current) return "Web";
  const known = AFRICAN_SOURCES.find((source) => current === source || current.endsWith(`.${source}`));
  if (known) return known;
  if (isAtsUrl(value)) return "Employer ATS";
  return "Public web";
}

function stableId(urlValue: string, title: string, company: string) {
  return `web:${normalize(`${urlValue}|${title}|${company}`).slice(0, 220)}`;
}

interface SearchHit {
  url?: string;
  title?: string;
  snippet?: string;
  text?: string;
}

function parseSearchHits(payload: any): SearchHit[] {
  const candidates = payload?.results ?? payload?.data ?? payload?.items ?? [];
  if (!Array.isArray(candidates)) return [];
  return candidates.map((item: any) => ({
    url: absoluteUrl(item?.url ?? item?.link),
    title: text(item?.title ?? item?.name),
    snippet: text(item?.snippet ?? item?.description ?? item?.content),
    text: text(item?.text ?? item?.rawContent ?? item?.raw_content),
  })).filter((item: SearchHit) => item.url);
}

async function requestJson(urlValue: string, init: RequestInit) {
  const response = await fetch(urlValue, {
    ...init,
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json();
}

async function exaSearch(query: string): Promise<SearchHit[]> {
  const key = text(process.env.EXA_API_KEY);
  if (!key) return [];
  const payload = await requestJson("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": key },
    body: JSON.stringify({ query, numResults: MAX_RESULTS_PER_ENGINE, type: "auto" }),
  });
  return parseSearchHits(payload);
}

async function tavilySearch(query: string): Promise<SearchHit[]> {
  const key = text(process.env.TAVILY_API_KEY);
  if (!key) return [];
  const payload = await requestJson("https://api.tavily.com/search", {
    method: "POST",
    body: JSON.stringify({ api_key: key, query, search_depth: "advanced", max_results: MAX_RESULTS_PER_ENGINE, include_answer: false, include_raw_content: false }),
  });
  return parseSearchHits(payload);
}

async function firecrawlSearch(query: string): Promise<SearchHit[]> {
  const key = text(process.env.FIRECRAWL_API_KEY);
  if (!key) return [];
  const endpoint = text(process.env.FIRECRAWL_SEARCH_URL) ?? "https://api.firecrawl.dev/v2/search";
  try {
    const payload = await requestJson(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, limit: MAX_RESULTS_PER_ENGINE }),
    });
    return parseSearchHits(payload);
  } catch {
    return [];
  }
}

function buildQueries(query: JobSearchQuery) {
  const country = countryName(query);
  const city = text(query.city);
  const title = query.title.trim();
  const suffix = city ? `${city}, ${country}` : country;
  const queries = [
    `"${title}" jobs ${suffix}`,
    `"${title}" vacancy ${suffix} apply`,
    `"${title}" careers ${suffix} employer`,
    `${title} ${suffix} hiring direct application`,
    `${title} ${suffix} jobs site:careers`,
  ];
  if (query.remote) queries.push(`"${title}" remote Africa direct employer`);
  return Array.from(new Set(queries)).slice(0, Math.max(3, Number(process.env.MAX_WEB_SEARCH_QUERIES) || 5));
}

function inferCompany(title: string, body: string) {
  const patterns = [
    /\bat\s+([A-Z][A-Za-z0-9&.'() -]{2,80}?)(?:\s*[|–—-]|\s+in\s+|\s+for\s+|$)/,
    /(?:job|role|vacancy|position)\s+(?:at|with|for)\s+([A-Z][A-Za-z0-9&.'() -]{2,80}?)(?:\s*[|–—-]|\s+in\s+|$)/i,
    /([A-Z][A-Za-z0-9&.'() -]{2,80})\s+(?:is|are)\s+hiring/i,
  ];
  for (const pattern of patterns) {
    const match = `${title} ${body}`.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[|–—-]+$/, "").trim();
  }
  return undefined;
}

function fromJsonLd(html: string, urlValue: string): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const raw of items) {
        const item = raw as any;
        const type = item?.["@type"];
        if (!(type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting")))) continue;
        const title = text(item.title);
        const company = text(item.hiringOrganization?.name ?? item.hiringOrganization);
        if (!title || !company) continue;
        const employerUrl = absoluteUrl(item.hiringOrganization?.url ?? item.hiringOrganization?.sameAs, urlValue);
        const applyUrl = absoluteUrl(item.url, urlValue) ?? urlValue;
        jobs.push({
          id: stableId(applyUrl, title, company),
          provider: "web_discovery",
          title,
          companyName: company,
          companyWebsite: employerUrl,
          companyDomain: host(employerUrl),
          description: clean(text(item.description) ?? ""),
          location: clean([item.jobLocation?.address?.addressLocality, item.jobLocation?.address?.addressRegion, item.jobLocation?.address?.addressCountry?.name ?? item.jobLocation?.address?.addressCountry].filter(Boolean).join(", ")) || undefined,
          countryCode: text(item.jobLocation?.address?.addressCountry?.name ?? item.jobLocation?.address?.addressCountry)?.match(/^[A-Za-z]{2}$/)?.[0]?.toUpperCase(),
          employmentType: text(item.employmentType),
          remote: /telecommute|remote/i.test(JSON.stringify(item.jobLocationType ?? item.jobLocation ?? "")),
          postedAt: text(item.datePosted),
          applyUrl,
          sourceUrl: urlValue,
          sourceName: sourceFromUrl(urlValue),
          requirements: [],
          verificationStatus: "unverified",
          verificationReasons: [
            "Discovered through Vantage deep web search.",
            "Employer ownership and application destination require independent verification.",
          ],
          verificationEvidence: [{ url: urlValue, reason: "Public job-page evidence." }],
        });
      }
    } catch {}
  }
  return jobs;
}

function fromSearchHit(hit: SearchHit, query: JobSearchQuery): NormalizedJob | undefined {
  const urlValue = hit.url;
  if (!urlValue || isNoiseUrl(urlValue) || !isLikelyJobUrl(urlValue)) return undefined;
  const title = clean(text(hit.title) ?? "");
  const body = clean(`${hit.snippet ?? ""} ${hit.text ?? ""}`);
  if (!title || !titleMatches(title, query) || !body) return undefined;
  const company = inferCompany(title, body);
  if (!company) return undefined;
  const directCandidate = isAtsUrl(urlValue) || /(?:career|careers|jobs|vacanc|opening|recruit|hiring)/i.test(urlValue);
  return {
    id: stableId(urlValue, title, company),
    provider: "web_discovery",
    title,
    companyName: company,
    description: body.slice(0, 8_000),
    countryCode: query.countryCode?.toUpperCase(),
    city: query.city,
    remote: query.remote ? /remote/i.test(body) : /remote/i.test(`${title} ${body}`) ? true : undefined,
    applyUrl: urlValue,
    sourceUrl: urlValue,
    sourceName: sourceFromUrl(urlValue),
    requirements: [],
    verificationStatus: "unverified",
    verificationReasons: [
      "Discovered through Vantage deep web search.",
      directCandidate ? "URL appears to be a career, vacancy, or ATS application surface." : "URL is a public discovery surface; direct employer status is not established yet.",
    ],
    verificationEvidence: [{ url: urlValue, reason: "Public search result evidence." }],
  };
}

async function fetchPublicPage(urlValue: string) {
  if (!(await isAllowedByRobots(urlValue))) return undefined;
  try {
    const response = await fetch(urlValue, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.6",
        "User-Agent": "VantageJobsBot/1.0",
      },
    });
    if (!response.ok) return undefined;
    return { url: response.url || urlValue, body: await response.text() };
  } catch {
    return undefined;
  }
}

function mergeJobs(jobs: NormalizedJob[]) {
  const map = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    const key = `${normalize(job.title)}|${normalize(job.companyName)}|${normalize(job.location ?? "")}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, job);
      continue;
    }
    map.set(key, {
      ...current,
      description: (job.description?.length ?? 0) > (current.description?.length ?? 0) ? job.description : current.description,
      companyWebsite: current.companyWebsite ?? job.companyWebsite,
      companyDomain: current.companyDomain ?? job.companyDomain,
      applyUrl: current.applyUrl ?? job.applyUrl,
      sourceUrl: current.sourceUrl ?? job.sourceUrl,
      sourceName: current.sourceName ?? job.sourceName,
      postedAt: current.postedAt ?? job.postedAt,
      remote: current.remote ?? job.remote,
      verificationReasons: Array.from(new Set([...current.verificationReasons, ...job.verificationReasons])),
      verificationEvidence: Array.from(new Map([...(current.verificationEvidence ?? []), ...(job.verificationEvidence ?? [])].map((item) => [item.url, item])).values()).slice(0, 12),
    });
  }
  return [...map.values()];
}

export async function runDeepWebJobDiscovery(query: JobSearchQuery): Promise<NormalizedJob[]> {
  const enabled = /^(1|true|yes)$/i.test(process.env.VANTAGE_ENABLE_DEEP_WEB_DISCOVERY ?? "true");
  if (!enabled) return [];
  if (!text(process.env.EXA_API_KEY) && !text(process.env.TAVILY_API_KEY) && !text(process.env.FIRECRAWL_API_KEY)) return [];

  const queries = buildQueries(query);
  const batches = await Promise.all(queries.map(async (searchQuery) => {
    const [exa, tavily, firecrawl] = await Promise.allSettled([exaSearch(searchQuery), tavilySearch(searchQuery), firecrawlSearch(searchQuery)]);
    return [
      ...(exa.status === "fulfilled" ? exa.value : []),
      ...(tavily.status === "fulfilled" ? tavily.value : []),
      ...(firecrawl.status === "fulfilled" ? firecrawl.value : []),
    ];
  }));

  const hits = batches.flat();
  const uniqueHits = Array.from(new Map(hits.map((hit) => [hit.url, hit])).values()).slice(0, MAX_CANDIDATES);
  const discovered = uniqueHits.map((hit) => fromSearchHit(hit, query)).filter(Boolean) as NormalizedJob[];
  const detailUrls = uniqueHits.map((hit) => hit.url).filter(Boolean).slice(0, MAX_DETAIL_PAGES) as string[];

  const details = await Promise.all(detailUrls.map((urlValue) => fetchPublicPage(urlValue)));
  for (const detail of details) {
    if (!detail) continue;
    const structured = fromJsonLd(detail.body, detail.url).filter((job) => titleMatches(job.title, query));
    discovered.push(...structured);
  }

  return mergeJobs(discovered).slice(0, Math.min(query.limit ?? 50, 100));
}
