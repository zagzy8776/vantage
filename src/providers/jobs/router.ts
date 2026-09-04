import type { JobDiscoveryProvider, JobProvider, JobProviderResult, JobSearchQuery, NormalizedJob } from "./types";
import { verifyEmployer } from "./verification";

function configured(name: JobProvider) {
  if (name === "adzuna") return Boolean(process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim());
  if (name === "jsearch") return Boolean(process.env.OPENWEBNINJA_API_KEY?.trim());
  if (name === "jobspipe") return Boolean(process.env.JOBSPIPE_API_KEY?.trim());
  if (name === "hirebase") return Boolean(process.env.HIREBASE_API_KEY?.trim());
  return Boolean(process.env.THEIRSTACK_API_KEY?.trim());
}

function cleanUrl(value: unknown) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function companyDomain(value: unknown) {
  const url = cleanUrl(value);
  if (!url) return undefined;
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return undefined; }
}

function stripMarkup(value?: string) {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function requirementsFromText(description?: string, summary?: string) {
  const source = stripMarkup([summary, description].filter(Boolean).join(". "));
  if (!source) return [];

  const candidates: string[] = [];
  const section = source.match(/(?:requirements?|qualifications?|what you(?:'|’)ll need|skills?|experience|must have|you bring)\s*[:\-]?\s*(.{0,1800}?)(?=(?:responsibilities|what you(?:'|’)ll do|benefits|about the (?:role|job|company)|$))/i)?.[1];
  const target = section || source;

  for (const match of target.matchAll(/(?:^|[.;]|\s[-•*])\s*((?:\d+\+?\s+years?[^.;]*|[A-Z][A-Za-z0-9+#./&()' -]{2,70}(?:experience|proficiency|skills?|knowledge|certification|degree|diploma|license|licen[cs]e|ability)[^.;]*|bachelor(?:'s)?[^.;]*|master(?:'s)?[^.;]*|CPA[^.;]*|ACCA[^.;]*|Excel[^.;]*|QuickBooks[^.;]*|Python[^.;]*|JavaScript[^.;]*|SQL[^.;]*))(?=[.;]|$)/gi)) {
    const value = match[1].replace(/\s+/g, " ").trim();
    if (value.length >= 4 && value.length <= 180) candidates.push(value);
  }

  if (!candidates.length && section) {
    for (const part of section.split(/\s*(?:•|\u2022|\||;|\n|\r)\s*/)) {
      const value = part.replace(/^[-*]\s*/, "").trim();
      if (value.length >= 5 && value.length <= 180) candidates.push(value);
    }
  }

  return Array.from(new Set(candidates)).slice(0, 12);
}

function directSignals(job: NormalizedJob) {
  const haystack = `${job.sourceUrl ?? ""} ${job.applyUrl ?? ""} ${job.companyWebsite ?? ""} ${job.description ?? ""}`.toLowerCase();
  const agency = /\b(recruit(?:er|ment)?|staffing|agency|on behalf of|headhunt|outsourc)/i.test(haystack);
  const ats = /greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|recruitee\.com|bamboohr\.com|personio\./i.test(haystack);
  return { agency, ats };
}

function normalize(job: Partial<NormalizedJob> & { id: string; provider: JobProvider; title: string; companyName: string }): NormalizedJob {
  const base = {
    ...job,
    requirements: job.requirements?.length ? Array.from(new Set(job.requirements)) : requirementsFromText(job.description),
    verificationStatus: "unverified" as const,
    verificationReasons: ["Discovered from a third-party job data provider; official employer verification has not run yet."],
  };
  const signals = directSignals(base);
  if (signals.agency) {
    return {
      ...base,
      verificationStatus: "needs_verification",
      verificationReasons: [...base.verificationReasons, "Recruitment/staffing language or domain signal detected."],
    };
  }
  if (signals.ats) {
    return {
      ...base,
      verificationStatus: "needs_verification",
      verificationReasons: [...base.verificationReasons, "Official ATS signal detected; employer ownership still requires verification."],
    };
  }
  return base;
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const body = await response.json().catch(() => null);
  if (response.status === 429) throw new Error("RATE_LIMITED");
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return body as Record<string, unknown> | null;
}

async function adzuna(query: JobSearchQuery): Promise<JobProviderResult> {
  const appId = process.env.ADZUNA_APP_ID?.trim();
  const appKey = process.env.ADZUNA_APP_KEY?.trim();
  if (!appId || !appKey) return { provider: "adzuna", status: "unavailable", jobs: [] };
  const country = (query.countryCode ?? "us").toLowerCase();
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/1`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", String(Math.min(query.limit ?? 20, 50)));
  url.searchParams.set("what", query.title);
  url.searchParams.set("content-type", "application/json");
  if (query.city) url.searchParams.set("where", query.city);
  if (query.postedWithinDays) url.searchParams.set("max_days_old", String(query.postedWithinDays));
  try {
    const body = await requestJson(url.toString());
    const rows = Array.isArray(body?.results) ? body.results : [];
    return { provider: "adzuna", status: rows.length ? "success" : "zero-results", jobs: rows.flatMap((row: any) => {
      const title = text(row.title); const companyName = text(row.company?.display_name);
      if (!title || !companyName || !text(row.id)) return [];
      const description = text(row.description);
      const sourceUrl = cleanUrl(row.redirect_url);
      return [normalize({ id: `adzuna:${row.id}`, provider: "adzuna", title, companyName, description,
        location: text(row.location?.display_name), city: text(row.location?.area?.at(-1)),
        salaryMin: typeof row.salary_min === "number" ? row.salary_min : undefined,
        salaryMax: typeof row.salary_max === "number" ? row.salary_max : undefined,
        salaryCurrency: text(row.salary_currency), postedAt: text(row.created),
        sourceUrl, sourceName: "Adzuna", requirements: requirementsFromText(description) })];
    }) };
  } catch (error) { return { provider: "adzuna", status: error instanceof Error && error.message === "RATE_LIMITED" ? "rate-limited" : "failed", jobs: [], errorMessage: error instanceof Error ? error.message : "Adzuna request failed." }; }
}

async function jsearch(query: JobSearchQuery): Promise<JobProviderResult> {
  const key = process.env.OPENWEBNINJA_API_KEY?.trim();
  if (!key) return { provider: "jsearch", status: "unavailable", jobs: [] };
  const url = new URL("https://api.openwebninja.com/jsearch/search-v2");
  url.searchParams.set("query", [query.title, query.city, query.country].filter(Boolean).join(" in "));
  url.searchParams.set("country", (query.countryCode ?? "us").toLowerCase()); url.searchParams.set("language", "en");
  if (query.remote) url.searchParams.set("work_from_home", "true");
  if (query.postedWithinDays) url.searchParams.set("date_posted", query.postedWithinDays <= 1 ? "today" : query.postedWithinDays <= 3 ? "3days" : query.postedWithinDays <= 7 ? "week" : "month");
  try {
    const body = await requestJson(url.toString(), { headers: { "x-api-key": key } }); const rows = Array.isArray(body?.data) ? body.data : [];
    return { provider: "jsearch", status: rows.length ? "success" : "zero-results", jobs: rows.flatMap((row: any) => {
      const title = text(row.job_title); const companyName = text(row.employer_name); const id = text(row.job_id); if (!title || !companyName || !id) return [];
      const description = text(row.job_description); const employerWebsite = cleanUrl(row.employer_website);
      return [normalize({ id: `jsearch:${id}`, provider: "jsearch", title, companyName,
        companyDomain: companyDomain(employerWebsite), companyWebsite: employerWebsite, description,
        location: [row.job_city, row.job_state, row.job_country].filter(Boolean).join(", ") || undefined,
        countryCode: text(row.job_country), city: text(row.job_city), employmentType: text(row.job_employment_type), remote: row.job_is_remote === true ? true : undefined,
        salaryMin: typeof row.job_min_salary === "number" ? row.job_min_salary : undefined, salaryMax: typeof row.job_max_salary === "number" ? row.job_max_salary : undefined,
        salaryCurrency: text(row.job_salary_currency), postedAt: text(row.job_posted_at_datetime_utc),
        applyUrl: cleanUrl(row.job_apply_link), sourceUrl: cleanUrl(row.job_apply_link), sourceName: "JSearch", requirements: requirementsFromText(description) })];
    }) };
  } catch (error) { return { provider: "jsearch", status: error instanceof Error && error.message === "RATE_LIMITED" ? "rate-limited" : "failed", jobs: [], errorMessage: error instanceof Error ? error.message : "JSearch request failed." }; }
}

async function jobspipe(query: JobSearchQuery): Promise<JobProviderResult> {
  const key = process.env.JOBSPIPE_API_KEY?.trim(); if (!key) return { provider: "jobspipe", status: "unavailable", jobs: [] };
  const payload: Record<string, unknown> = { job_title_or: [query.title], limit: Math.min(query.limit ?? 25, 100) };
  if (query.countryCode) payload.job_country_code_or = [query.countryCode.toUpperCase()]; if (query.remote !== undefined) payload.remote = query.remote; if (query.postedWithinDays) payload.posted_at_max_age_days = query.postedWithinDays;
  try {
    const body = await requestJson("https://api.jobspipe.dev/v1/jobs/search", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const rows = Array.isArray(body?.data) ? body.data : [];
    return { provider: "jobspipe", status: rows.length ? "success" : "zero-results", jobs: rows.flatMap((row: any) => {
      const title = text(row.title ?? row.job_title); const companyName = text(row.company); const id = text(row.id); if (!title || !companyName || !id) return [];
      const description = text(row.description); const sourceUrl = cleanUrl(row.source_url); const applyUrl = cleanUrl(row.apply_url);
      return [normalize({ id: `jobspipe:${id}`, provider: "jobspipe", title, companyName, description, location: text(row.location), countryCode: text(row.country_code), remote: row.remote === true ? true : undefined,
        employmentType: text(row.employment_type), postedAt: text(row.posted_at), lastSeenAt: text(row.last_seen_at), applyUrl, sourceUrl: sourceUrl ?? applyUrl, sourceName: text(row.source), requirements: requirementsFromText(description) })];
    }) };
  } catch (error) { return { provider: "jobspipe", status: error instanceof Error && error.message === "RATE_LIMITED" ? "rate-limited" : "failed", jobs: [], errorMessage: error instanceof Error ? error.message : "JobsPipe request failed." }; }
}

async function hirebase(query: JobSearchQuery): Promise<JobProviderResult> {
  const key = process.env.HIREBASE_API_KEY?.trim(); if (!key) return { provider: "hirebase", status: "unavailable", jobs: [] };
  const payload: Record<string, unknown> = { job_titles: [query.title], limit: Math.min(query.limit ?? 10, 50) };
  if (query.remote !== undefined) payload.location_types = [query.remote ? "Remote" : "On-site"];
  if (query.city || query.country) payload.geo_locations = [{ ...(query.city ? { city: query.city } : {}), ...(query.country ? { country: query.country } : {}) }];
  try {
    const body = await requestJson("https://api.hirebase.org/v2/jobs/search", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key }, body: JSON.stringify(payload) });
    const rows = Array.isArray(body?.jobs) ? body.jobs : [];
    return { provider: "hirebase", status: rows.length ? "success" : "zero-results", jobs: rows.flatMap((row: any) => {
      const title = text(row.job_title); const companyName = text(row.company_name); const id = text(row._id); if (!title || !companyName || !id) return [];
      const location = Array.isArray(row.locations) ? row.locations[0] : undefined; const description = text(row.description); const summary = text(row.requirements_summary);
      const companyWebsite = cleanUrl(row.company_link);
      return [normalize({ id: `hirebase:${id}`, provider: "hirebase", title, companyName, companyWebsite, companyDomain: companyDomain(companyWebsite), description,
        location: [location?.city, location?.region, location?.country].filter(Boolean).join(", ") || undefined, city: text(location?.city), employmentType: text(row.job_type), remote: /remote/i.test(text(row.location_type) ?? "") ? true : undefined,
        applyUrl: cleanUrl(row.application_link), sourceUrl: cleanUrl(row.application_link), sourceName: "Hirebase", requirements: requirementsFromText(description, summary) })];
    }) };
  } catch (error) { return { provider: "hirebase", status: error instanceof Error && error.message === "RATE_LIMITED" ? "rate-limited" : "failed", jobs: [], errorMessage: error instanceof Error ? error.message : "Hirebase request failed." }; }
}

async function theirStack(query: JobSearchQuery): Promise<JobProviderResult> {
  const key = process.env.THEIRSTACK_API_KEY?.trim(); if (!key) return { provider: "theirstack", status: "unavailable", jobs: [] };
  const payload: Record<string, unknown> = { job_title_or: [query.title], limit: Math.min(query.limit ?? 25, 100), page: 0, posted_at_max_age_days: query.postedWithinDays ?? 30 };
  if (query.countryCode) payload.job_country_code_or = [query.countryCode.toUpperCase()]; if (query.remote !== undefined) payload.remote = query.remote;
  try {
    const body = await requestJson("https://api.theirstack.com/v1/jobs/search", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const rows = Array.isArray(body?.data) ? body.data : [];
    return { provider: "theirstack", status: rows.length ? "success" : "zero-results", jobs: rows.flatMap((row: any) => {
      const title = text(row.job_title ?? row.title); const companyName = text(row.company); const id = row.job_id != null ? String(row.job_id) : undefined; if (!title || !companyName || !id) return [];
      const description = text(row.description); const domain = text(row.company_domain); const companyWebsite = cleanUrl(domain ? `https://${domain}` : undefined); const applyUrl = cleanUrl(row.final_url ?? row.url);
      return [normalize({ id: `theirstack:${id}`, provider: "theirstack", title, companyName, companyDomain: domain, companyWebsite, description,
        location: Array.isArray(row.cities) ? row.cities.join(", ") : text(row.location), countryCode: text(row.job_country_code), employmentType: Array.isArray(row.employment_statuses) ? row.employment_statuses.join(", ") : text(row.employment_status), remote: row.remote === true ? true : undefined,
        salaryMin: typeof row.min_annual_salary_usd === "number" ? row.min_annual_salary_usd : undefined, salaryMax: typeof row.max_annual_salary_usd === "number" ? row.max_annual_salary_usd : undefined, salaryCurrency: "USD",
        postedAt: text(row.date_posted ?? row.posted_at), applyUrl, sourceUrl: cleanUrl(row.source_url ?? applyUrl), sourceName: "TheirStack", requirements: requirementsFromText(description) })];
    }) };
  } catch (error) { return { provider: "theirstack", status: error instanceof Error && error.message === "RATE_LIMITED" ? "rate-limited" : "failed", jobs: [], errorMessage: error instanceof Error ? error.message : "TheirStack request failed." }; }
}

const providers: Record<JobProvider, JobDiscoveryProvider> = { adzuna: { name: "adzuna", search: adzuna }, jsearch: { name: "jsearch", search: jsearch }, jobspipe: { name: "jobspipe", search: jobspipe }, hirebase: { name: "hirebase", search: hirebase }, theirstack: { name: "theirstack", search: theirStack } };

function dedupe(jobs: NormalizedJob[]) {
  const seen = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    const key = `${job.companyName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${job.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${(job.location ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
    const existing = seen.get(key);
    if (!existing) { seen.set(key, job); continue; }
    seen.set(key, { ...existing, ...job, applyUrl: existing.applyUrl ?? job.applyUrl, sourceUrl: existing.sourceUrl ?? job.sourceUrl, companyDomain: existing.companyDomain ?? job.companyDomain,
      companyWebsite: existing.companyWebsite ?? job.companyWebsite, requirements: Array.from(new Set([...(existing.requirements ?? []), ...(job.requirements ?? [])])),
      verificationReasons: Array.from(new Set([...existing.verificationReasons, ...job.verificationReasons])),
      verificationEvidence: [...(existing.verificationEvidence ?? []), ...(job.verificationEvidence ?? [])].filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url && candidate.reason === item.reason) === index) });
  }
  return Array.from(seen.values());
}

async function verifyTopJobs(jobs: NormalizedJob[]) {
  const candidateIndexes = jobs.map((job, index) => ({ job, index })).filter(({ job }) => job.verificationStatus !== "rejected").slice(0, 12).map(({ index }) => index);
  const verified = [...jobs];
  for (let index = 0; index < candidateIndexes.length; index += 3) {
    const batchIndexes = candidateIndexes.slice(index, index + 3);
    const results = await Promise.all(batchIndexes.map(async (jobIndex) => {
      const job = jobs[jobIndex];
      try {
        const verification = await verifyEmployer(job);
        return { index: jobIndex, job: { ...job, companyDomain: verification.companyDomain ?? job.companyDomain, verificationStatus: verification.status, verificationScore: verification.score, verificationReasons: verification.reasons, verificationEvidence: verification.evidence } satisfies NormalizedJob };
      } catch {
        return { index: jobIndex, job: { ...job, verificationStatus: "needs_verification" as const, verificationReasons: [...job.verificationReasons, "Employer verification could not be completed for this listing."] } };
      }
    }));
    for (const result of results) verified[result.index] = result.job;
  }
  return verified;
}

export async function runJobDiscovery(query: JobSearchQuery, selected?: JobProvider[]) {
  const names = selected?.length ? selected : (Object.keys(providers) as JobProvider[]);
  const results = await Promise.all(names.map((name) => providers[name].search(query)));
  const discovered = dedupe(results.flatMap((result) => result.jobs));
  const jobs = (await verifyTopJobs(discovered)).slice(0, Math.min(query.limit ?? 25, 100));
  return { jobs, providers: results.map((result) => ({ provider: result.provider, status: result.status, count: result.jobs.length, errorMessage: result.errorMessage })), configuredProviders: names.filter(configured), verification: { attempted: Math.min(discovered.length, 12), verified: jobs.filter((job) => job.verificationStatus === "direct_employer_verified").length } };
}
