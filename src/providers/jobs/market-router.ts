import { runJobDiscovery as runGlobalJobDiscovery } from "./router";
import { MARKET_REGIONAL_PRIORITY, REGIONAL_SOURCE_REGISTRY } from "./source-registry";
import { crawlRegionalSource } from "./regional-source-engine";
import type { JobProvider, JobSearchQuery, NormalizedJob, RegionalJobProvider } from "./types";

const GLOBAL_PROVIDERS: JobProvider[] = ["adzuna", "jsearch", "jobspipe", "hirebase", "theirstack"];
const REGIONAL_PROVIDERS = new Set<RegionalJobProvider>(REGIONAL_SOURCE_REGISTRY.map((source) => source.provider));

function key(job: NormalizedJob) {
  return `${job.companyName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${job.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${(job.location ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
}

function mergeJobs(jobs: NormalizedJob[]) {
  const map = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    const id = key(job);
    const existing = map.get(id);
    if (!existing) {
      map.set(id, job);
      continue;
    }
    const verificationEvidence = Array.from(new Map([...(existing.verificationEvidence ?? []), ...(job.verificationEvidence ?? [])].map((item) => [item.url, item])).values()).slice(0, 12);
    map.set(id, {
      ...existing,
      description: (job.description?.length ?? 0) > (existing.description?.length ?? 0) ? job.description : existing.description,
      companyDomain: existing.companyDomain ?? job.companyDomain,
      companyWebsite: existing.companyWebsite ?? job.companyWebsite,
      applyUrl: existing.applyUrl ?? job.applyUrl,
      postedAt: existing.postedAt ?? job.postedAt,
      remote: existing.remote ?? job.remote,
      salaryMin: existing.salaryMin ?? job.salaryMin,
      salaryMax: existing.salaryMax ?? job.salaryMax,
      salaryCurrency: existing.salaryCurrency ?? job.salaryCurrency,
      requirements: Array.from(new Set([...(existing.requirements ?? []), ...(job.requirements ?? [])])).slice(0, 16),
      verificationReasons: Array.from(new Set([...existing.verificationReasons, ...job.verificationReasons, `Also discovered via ${job.sourceName ?? job.provider}.`])),
      verificationEvidence,
    });
  }
  return [...map.values()];
}

export async function runMarketJobDiscovery(query: JobSearchQuery, selected?: Array<JobProvider | RegionalJobProvider>, options?: { verify?: boolean }) {
  const country = (query.countryCode ?? "NG").toUpperCase();
  const requested = selected?.length ? Array.from(new Set(selected)) : undefined;
  const defaultRegional = MARKET_REGIONAL_PRIORITY[country] ?? [];
  const regional = (requested?.filter((provider): provider is RegionalJobProvider => REGIONAL_PROVIDERS.has(provider as RegionalJobProvider)) ?? defaultRegional).slice(0, 12);
  const global = (requested?.filter((provider): provider is JobProvider => GLOBAL_PROVIDERS.includes(provider as JobProvider)) ?? GLOBAL_PROVIDERS).filter((provider) => GLOBAL_PROVIDERS.includes(provider));

  const emptyGlobal = {
    jobs: [] as NormalizedJob[],
    page: query.page ?? 1,
    providers: [],
    configuredProviders: [],
    pagination: {} as Record<string, unknown>,
    verification: { attempted: 0, verified: 0 },
    discoveryCount: 0,
  };

  const [globalDiscovery, regionalResults] = await Promise.all([
    global.length ? runGlobalJobDiscovery(query, global, options) : Promise.resolve(emptyGlobal),
    Promise.all(regional.map((provider) => crawlRegionalSource(provider, query))),
  ]);

  const jobs = mergeJobs([...globalDiscovery.jobs, ...regionalResults.flatMap((result) => result.jobs)]);
  const providers = [
    ...globalDiscovery.providers,
    ...regionalResults.map((result) => ({ provider: result.provider, status: result.status, count: result.jobs.length, totalCount: result.totalCount ?? null, errorMessage: result.errorMessage, acquisition: result.acquisition ?? [] })),
  ];
  const pagination = {
    ...globalDiscovery.pagination,
    ...Object.fromEntries(regionalResults.map((result) => [result.provider, { totalCount: result.totalCount ?? null, nextCursor: result.nextCursor ?? null, hasMore: Boolean(result.hasMore) }])),
  };
  const configuredProviders = [...globalDiscovery.configuredProviders, ...regionalResults.filter((result) => result.status !== "unavailable").map((result) => result.provider)];

  return {
    ...globalDiscovery,
    jobs,
    providers,
    configuredProviders,
    pagination,
    discoveryCount: jobs.length,
    verification: {
      attempted: jobs.length,
      verified: jobs.filter((job) => job.verificationStatus === "direct_employer_verified").length,
    },
  };
}
