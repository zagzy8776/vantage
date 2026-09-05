import { runJobDiscovery as runGlobalJobDiscovery } from "./router";
import { MARKET_REGIONAL_PRIORITY, REGIONAL_SOURCE_REGISTRY } from "./source-registry";
import { crawlRegionalSource } from "./regional-source-engine";
import { runDeepWebJobDiscovery } from "./deep-web-discovery";
import { renderJobPages } from "./firecrawl-renderer";
import { verifyEmployer } from "./verification";
import type { JobProvider, JobSearchQuery, NormalizedJob, RegionalJobProvider } from "./types";

const GLOBAL_PROVIDERS: JobProvider[] = ["adzuna", "jsearch", "jobspipe", "hirebase", "theirstack"];
const REGIONAL_PROVIDERS = new Set<RegionalJobProvider>(REGIONAL_SOURCE_REGISTRY.map((source) => source.provider));
const DEEP_VERIFY_LIMIT = Math.max(4, Math.min(Number(process.env.JOB_DEEP_VERIFY_LIMIT) || 12, 24));

function key(job: NormalizedJob) {
  return `${job.companyName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${job.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${(job.location ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
}

function publicEmployerCandidate(job: NormalizedJob) {
  if (job.companyWebsite) return job.companyWebsite;
  if (!job.sourceUrl) return undefined;
  try {
    const url = new URL(job.sourceUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const aggregatorHosts = ["myjobmag.com", "jobberman.com", "hotnigerianjobs.com", "jobgurus.com.ng", "jobsinnigeria.ng", "workinnigeria.org", "fuzu.com", "careerjet.com", "careerjet.co.za", "brightermonday.co.ke", "brightermonday.co.ug", "careers24.com", "careerjunction.co.za", "pnet.co.za", "careerlinkafrica.com", "jobsphere.net", "jobsearch.africa", "postkazi.com", "hiresasa.com", "talentpot.org", "worknation.africa", "closely.ng", "africajobline.com", "jobconnectafrica.com", "pac.africa"];
    const isAggregator = aggregatorHosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
    if (isAggregator || /(?:greenhouse|lever|ashbyhq|smartrecruiters|workday|myworkday|icims|bamboohr|successfactors|oraclecloud)/i.test(host)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function employerDomain(urlValue?: string) {
  if (!urlValue) return undefined;
  try { return new URL(urlValue).hostname.toLowerCase().replace(/^www\./, ""); } catch { return undefined; }
}

async function verifyDeepCandidates(jobs: NormalizedJob[]) {
  const prioritized = jobs
    .map((job) => {
      const employerWebsite = publicEmployerCandidate(job);
      return { ...job, companyWebsite: employerWebsite, companyDomain: job.companyDomain ?? employerDomain(employerWebsite) };
    })
    .filter((job) => Boolean(job.companyWebsite))
    .slice(0, DEEP_VERIFY_LIMIT);

  const verified = await Promise.all(prioritized.map(async (job) => {
    const result = await verifyEmployer(job);
    return {
      ...job,
      verificationStatus: result.status,
      verificationScore: result.score,
      verificationReasons: Array.from(new Set([...job.verificationReasons, ...result.reasons])),
      verificationEvidence: Array.from(new Map([...(job.verificationEvidence ?? []), ...result.evidence].map((item) => [item.url, item])).values()).slice(0, 12),
      companyDomain: result.companyDomain ?? job.companyDomain,
    };
  }));
  const verifiedKeys = new Set(verified.map(key));
  return jobs.map((job) => verifiedKeys.has(key(job)) ? verified.find((item) => key(item) === key(job)) ?? job : job);
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
    const stronger = job.verificationStatus === "direct_employer_verified" && existing.verificationStatus !== "direct_employer_verified" ? job : existing;
    map.set(id, {
      ...stronger,
      description: (job.description?.length ?? 0) > (existing.description?.length ?? 0) ? job.description : existing.description,
      companyDomain: stronger.companyDomain ?? job.companyDomain ?? existing.companyDomain,
      companyWebsite: stronger.companyWebsite ?? job.companyWebsite ?? existing.companyWebsite,
      applyUrl: stronger.applyUrl ?? job.applyUrl ?? existing.applyUrl,
      postedAt: stronger.postedAt ?? job.postedAt ?? existing.postedAt,
      remote: stronger.remote ?? job.remote ?? existing.remote,
      salaryMin: stronger.salaryMin ?? job.salaryMin ?? existing.salaryMin,
      salaryMax: stronger.salaryMax ?? job.salaryMax ?? existing.salaryMax,
      salaryCurrency: stronger.salaryCurrency ?? job.salaryCurrency ?? existing.salaryCurrency,
      requirements: Array.from(new Set([...(existing.requirements ?? []), ...(job.requirements ?? [])])).slice(0, 16),
      verificationReasons: Array.from(new Set([...existing.verificationReasons, ...job.verificationReasons, `Also discovered via ${job.provider}.`])),
      verificationEvidence,
    });
  }
  return [...map.values()];
}

function hideProviderBranding(jobs: NormalizedJob[]) {
  return jobs.map((job) => ({ ...job, sourceName: "Vantage intelligence" }));
}

export async function runMarketJobDiscovery(query: JobSearchQuery, selected?: Array<JobProvider | RegionalJobProvider>, options?: { verify?: boolean; deepWeb?: boolean }) {
  const country = (query.countryCode ?? "NG").toUpperCase();
  const requested = selected?.length ? Array.from(new Set(selected)) : undefined;
  const defaultRegional = MARKET_REGIONAL_PRIORITY[country] ?? [];
  const regional = (requested?.filter((provider): provider is RegionalJobProvider => REGIONAL_PROVIDERS.has(provider as RegionalJobProvider)) ?? defaultRegional).slice(0, 12);
  const global = (requested?.filter((provider): provider is JobProvider => GLOBAL_PROVIDERS.includes(provider as JobProvider)) ?? GLOBAL_PROVIDERS).filter((provider) => GLOBAL_PROVIDERS.includes(provider));
  const deepWeb = options?.deepWeb === false ? Promise.resolve([] as NormalizedJob[]) : runDeepWebJobDiscovery(query);

  const emptyGlobal = {
    jobs: [] as NormalizedJob[],
    page: query.page ?? 1,
    providers: [],
    configuredProviders: [],
    pagination: {} as Record<string, unknown>,
    verification: { attempted: 0, verified: 0 },
    discoveryCount: 0,
  };

  const [globalDiscovery, regionalResults, deepJobs] = await Promise.all([
    global.length ? runGlobalJobDiscovery(query, global, options) : Promise.resolve(emptyGlobal),
    Promise.all(regional.map((provider) => crawlRegionalSource(provider, query))),
    deepWeb,
  ]);

  const renderedDeepJobs = deepJobs.length ? await renderJobPages(deepJobs.map((job) => job.sourceUrl).filter(Boolean) as string[], query) : [];
  const researchedDeepJobs = await verifyDeepCandidates([...deepJobs, ...renderedDeepJobs]);
  const mergedRaw = mergeJobs([...globalDiscovery.jobs, ...regionalResults.flatMap((result) => result.jobs), ...researchedDeepJobs]);
  const merged = hideProviderBranding(mergedRaw);
  const jobs = query.directOnly ? merged.filter((job) => job.verificationStatus === "direct_employer_verified") : merged;
  const providers = [
    ...globalDiscovery.providers,
    ...regionalResults.map((result) => ({ provider: result.provider, status: result.status, count: result.jobs.length, totalCount: result.totalCount ?? null, errorMessage: result.errorMessage, acquisition: result.acquisition ?? [] })),
  ];
  const pagination = {
    ...globalDiscovery.pagination,
    ...Object.fromEntries(regionalResults.map((result) => [result.provider, { totalCount: result.totalCount ?? null, nextCursor: result.nextCursor ?? null, hasMore: Boolean(result.hasMore) }])),
    web_discovery: { totalCount: researchedDeepJobs.length, hasMore: false },
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
      attempted: merged.length,
      verified: merged.filter((job) => job.verificationStatus === "direct_employer_verified").length,
    },
  };
}
