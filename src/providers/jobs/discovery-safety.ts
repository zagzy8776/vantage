import type { NormalizedJob } from "./types";

const KNOWN_AGGREGATORS = new Set([
  "myjobmag.com",
  "jobberman.com",
  "hotnigerianjobs.com",
  "jobgurus.com.ng",
  "jobsinnigeria.ng",
  "workinnigeria.org",
  "fuzu.com",
  "careerjet.com",
  "careerjet.co.za",
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
  "adzuna.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "monster.com",
  "jooble.org",
  "simplyhired.com",
  "talent.com",
  "careerbuilder.com",
  "jobrapido.com",
]);

const ATS_HOSTS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "smartrecruiters.com",
  "recruitee.com",
  "bamboohr.com",
  "personio.de",
  "personio.com",
  "workday.com",
  "myworkdayjobs.com",
  "icims.com",
  "jobvite.com",
  "teamtailor.com",
  "workable.com",
  "successfactors.com",
  "oraclecloud.com",
];

function host(value?: string) {
  try { return value ? new URL(value).hostname.toLowerCase().replace(/^www\./, "") : undefined; } catch { return undefined; }
}

function isHostIn(value: string | undefined, hosts: string[]) {
  const current = host(value);
  return Boolean(current && hosts.some((candidate) => current === candidate || current.endsWith(`.${candidate}`)));
}

export function isKnownAggregatorUrl(value?: string) {
  return isHostIn(value, [...KNOWN_AGGREGATORS]);
}

export function isAtsUrl(value?: string) {
  return isHostIn(value, ATS_HOSTS);
}

export function isEmployerUrl(job: NormalizedJob, value?: string) {
  const current = host(value);
  const employer = job.companyDomain ?? host(job.companyWebsite);
  if (!current || !employer || isAtsUrl(value) || isKnownAggregatorUrl(value)) return false;
  return current === employer || current.endsWith(`.${employer}`) || employer.endsWith(`.${current}`);
}

export function sanitizeDiscoveredJob(job: NormalizedJob): NormalizedJob {
  const applicationUrl = job.applyUrl;
  if (!applicationUrl) return { ...job, sourceName: "Vantage intelligence" };
  if (isAtsUrl(applicationUrl) || isEmployerUrl(job, applicationUrl)) return { ...job, sourceName: "Vantage intelligence" };

  const sourceIsAggregator = isKnownAggregatorUrl(job.sourceUrl);
  const reason = sourceIsAggregator
    ? "A third-party publisher URL was discovered, but Vantage will not present that redirect as a direct employer application path."
    : "The discovered application URL is not yet tied to the employer domain or a recognized ATS; Vantage will verify the destination before presenting it as direct.");

  return {
    ...job,
    applyUrl: undefined,
    sourceName: "Vantage intelligence",
    verificationReasons: Array.from(new Set([...(job.verificationReasons ?? []), reason])),
  };
}

export function sanitizeDiscoveredJobs(jobs: NormalizedJob[]) {
  return jobs.map(sanitizeDiscoveredJob);
}
