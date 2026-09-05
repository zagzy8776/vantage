import { runJobDiscovery as runGlobalJobDiscovery } from "./router";
import type { JobProvider, JobSearchQuery, NormalizedJob, RegionalJobProvider } from "./types";
import { REGIONAL_JOB_SOURCES, scrapeRegionalSource } from "./regional-scraper";
import { NIGERIA_WEB_SOURCES, scrapeNigeriaSource } from "./nigeria-source-crawler";

const GLOBAL_PROVIDERS: JobProvider[] = ["adzuna", "jsearch", "jobspipe", "hirebase", "theirstack"];
const REGIONAL_PROVIDERS = new Set<RegionalJobProvider>(REGIONAL_JOB_SOURCES.map((source) => source.provider));
const REGIONAL_PRIORITY: Record<string, RegionalJobProvider[]> = {
  NG: ["myjobmag", "jobberman", "hotnigerianjobs", "jobgurus", "jobsinnigeria", "workinnigeria", "fuzu", "careerjet"],
  GH: ["myjobmag", "jobberman", "fuzu", "brightermonday", "careerjet"],
  KE: ["myjobmag", "fuzu", "brightermonday", "careerjet"],
  UG: ["fuzu", "brightermonday"],
  ZA: ["myjobmag", "careerjet", "careers24", "careerjunction", "pnet"],
};
const NIGERIA_SOURCE_IDS = new Set<RegionalJobProvider>(NIGERIA_WEB_SOURCES.map((source) => source.provider));

function key(job: NormalizedJob) { return `${job.companyName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${job.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${(job.location ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`; }
function mergeJobs(jobs: NormalizedJob[]) { const map = new Map<string, NormalizedJob>(); for (const job of jobs) { const existing = map.get(key(job)); if (!existing) { map.set(key(job), job); continue; } const reasons = Array.from(new Set([...existing.verificationReasons, ...job.verificationReasons, `Also discovered via ${job.sourceName ?? job.provider}.`])); const verificationEvidence = Array.from(new Map([...(existing.verificationEvidence ?? []), ...(job.verificationEvidence ?? [])].map((item) => [item.url, item])).values()).slice(0, 12); map.set(key(job), { ...existing, description: (job.description?.length ?? 0) > (existing.description?.length ?? 0) ? job.description : existing.description, companyDomain: existing.companyDomain ?? job.companyDomain, companyWebsite: existing.companyWebsite ?? job.companyWebsite, applyUrl: existing.applyUrl ?? job.applyUrl, postedAt: existing.postedAt ?? job.postedAt, requirements: Array.from(new Set([...(existing.requirements ?? []), ...(job.requirements ?? [])])).slice(0, 16), verificationReasons: reasons, verificationEvidence }); } return Array.from(map.values()); }

async function regionalDiscovery(provider: RegionalJobProvider, query: JobSearchQuery) {
  if ((query.countryCode ?? "NG").toUpperCase() === "NG" && NIGERIA_SOURCE_IDS.has(provider)) return scrapeNigeriaSource(provider, query);
  return scrapeRegionalSource(provider, query);
}

export async function runMarketJobDiscovery(query: JobSearchQuery, selected?: Array<JobProvider | RegionalJobProvider>, options?: { verify?: boolean }) {
  const country = (query.countryCode ?? "NG").toUpperCase();
  const requested = selected?.length ? Array.from(new Set(selected)) : undefined;
  const regional = (requested?.filter((provider): provider is RegionalJobProvider => REGIONAL_PROVIDERS.has(provider as RegionalJobProvider)) ?? REGIONAL_PRIORITY[country] ?? []).slice(0, 10);
  const global = (requested?.filter((provider): provider is JobProvider => !REGIONAL_PROVIDERS.has(provider as RegionalJobProvider)) ?? GLOBAL_PROVIDERS).filter((provider) => GLOBAL_PROVIDERS.includes(provider));
  const [globalDiscovery, regionalResults] = await Promise.all([
    global.length ? runGlobalJobDiscovery(query, global, options) : Promise.resolve({ jobs: [] as NormalizedJob[], page: query.page ?? 1, providers: [], configuredProviders: [], pagination: {}, verification: { attempted: 0, verified: 0 }, discoveryCount: 0 }),
    Promise.all(regional.map((provider) => regionalDiscovery(provider, query))),
  ]);
  const jobs = mergeJobs([...globalDiscovery.jobs, ...regionalResults.flatMap((result) => result.jobs)]);
  const providerSummaries = [
    ...globalDiscovery.providers,
    ...regionalResults.map((result) => ({ provider: result.provider, status: result.status, count: result.jobs.length, totalCount: result.totalCount ?? null, errorMessage: result.errorMessage })),
  ];
  const pagination = { ...globalDiscovery.pagination, ...Object.fromEntries(regionalResults.map((result) => [result.provider, { totalCount: result.totalCount ?? null, nextCursor: result.nextCursor ?? null, hasMore: Boolean(result.hasMore) }])) };
  const configuredProviders = [...globalDiscovery.configuredProviders, ...regional];
  const discoveryCount = jobs.length;
  return { ...globalDiscovery, jobs, providers: providerSummaries, configuredProviders, pagination, discoveryCount, verification: { attempted: jobs.length, verified: jobs.filter((job) => job.verificationStatus === "direct_employer_verified").length } };
}
