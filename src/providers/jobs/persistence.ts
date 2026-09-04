import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { AuthContext } from "@/auth/types";
import type { NormalizedJob } from "./types";

function dateOrNull(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function providerJobId(job: NormalizedJob) {
  const prefix = `${job.provider}:`;
  return job.id.startsWith(prefix) ? job.id.slice(prefix.length) : job.id;
}

export async function persistJobs(jobs: NormalizedJob[], auth: Pick<AuthContext, "userId" | "organizationId">) {
  if (!jobs.length) return 0;

  const db = getDb();
  let persisted = 0;

  for (const job of jobs) {
    const now = new Date();
    const postedAt = dateOrNull(job.postedAt);
    const lastSeenAt = dateOrNull(job.lastSeenAt) ?? now;
    const reasons = JSON.stringify(job.verificationReasons ?? []);
    const requirements = JSON.stringify(job.requirements ?? []);

    await db.execute(sql`
      INSERT INTO jobs (
        id, provider, provider_job_id, title, company_name, company_domain,
        description, location, country_code, city, employment_type, remote,
        salary_min, salary_max, salary_currency, posted_at, last_seen_at,
        apply_url, source_url, source_name, requirements,
        verification_status, verification_score, verification_reasons,
        owner_id, organization_id, stale, created_at, updated_at
      ) VALUES (
        ${job.id}, ${job.provider}, ${providerJobId(job)}, ${job.title}, ${job.companyName}, ${job.companyDomain ?? null},
        ${job.description ?? null}, ${job.location ?? null}, ${job.countryCode ?? null}, ${job.city ?? null},
        ${job.employmentType ?? null}, ${job.remote ?? null}, ${job.salaryMin ?? null}, ${job.salaryMax ?? null},
        ${job.salaryCurrency ?? null}, ${postedAt}, ${lastSeenAt}, ${job.applyUrl ?? null}, ${job.sourceUrl ?? null},
        ${job.sourceName ?? null}, ${requirements}::jsonb, ${job.verificationStatus}, 0, ${reasons}::jsonb,
        ${auth.userId}, ${auth.organizationId ?? null}, false, ${now}, ${now}
      )
      ON CONFLICT (provider, provider_job_id, owner_id) DO UPDATE SET
        title = EXCLUDED.title,
        company_name = EXCLUDED.company_name,
        company_domain = COALESCE(EXCLUDED.company_domain, jobs.company_domain),
        description = COALESCE(EXCLUDED.description, jobs.description),
        location = COALESCE(EXCLUDED.location, jobs.location),
        country_code = COALESCE(EXCLUDED.country_code, jobs.country_code),
        city = COALESCE(EXCLUDED.city, jobs.city),
        employment_type = COALESCE(EXCLUDED.employment_type, jobs.employment_type),
        remote = COALESCE(EXCLUDED.remote, jobs.remote),
        salary_min = COALESCE(EXCLUDED.salary_min, jobs.salary_min),
        salary_max = COALESCE(EXCLUDED.salary_max, jobs.salary_max),
        salary_currency = COALESCE(EXCLUDED.salary_currency, jobs.salary_currency),
        posted_at = COALESCE(EXCLUDED.posted_at, jobs.posted_at),
        last_seen_at = EXCLUDED.last_seen_at,
        apply_url = COALESCE(EXCLUDED.apply_url, jobs.apply_url),
        source_url = COALESCE(EXCLUDED.source_url, jobs.source_url),
        source_name = COALESCE(EXCLUDED.source_name, jobs.source_name),
        requirements = EXCLUDED.requirements,
        verification_status = EXCLUDED.verification_status,
        verification_reasons = EXCLUDED.verification_reasons,
        stale = false,
        updated_at = EXCLUDED.updated_at
    `);

    await db.execute(sql`
      INSERT INTO job_verification_events (id, job_id, owner_id, status, score, evidence, reasons, observed_at)
      VALUES (
        ${crypto.randomUUID()}, ${job.id}, ${auth.userId}, ${job.verificationStatus}, 0,
        '[]'::jsonb, ${reasons}::jsonb, ${now}
      )
    `);

    persisted += 1;
  }

  return persisted;
}

export async function listPersistedJobs(
  auth: Pick<AuthContext, "userId" | "organizationId">,
  limit = 50,
) {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 200));
  const rows = await db.execute(sql`
    SELECT id, provider, title, company_name AS "companyName", company_domain AS "companyDomain",
      description, location, country_code AS "countryCode", city, employment_type AS "employmentType",
      remote, salary_min AS "salaryMin", salary_max AS "salaryMax", salary_currency AS "salaryCurrency",
      posted_at AS "postedAt", last_seen_at AS "lastSeenAt", apply_url AS "applyUrl", source_url AS "sourceUrl",
      source_name AS "sourceName", requirements, verification_status AS "verificationStatus",
      verification_score AS "verificationScore", verification_reasons AS "verificationReasons", stale
    FROM jobs
    WHERE owner_id = ${auth.userId}
      AND (${auth.organizationId ?? null} IS NULL OR organization_id = ${auth.organizationId ?? null})
    ORDER BY COALESCE(posted_at, last_seen_at) DESC NULLS LAST
    LIMIT ${safeLimit}
  `);
  return rows;
}
