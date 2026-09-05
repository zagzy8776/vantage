import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { AuthContext } from "@/auth/types";

export type JobSearchHistoryInput = {
  query: string;
  countryCode?: string;
  country?: string;
  city?: string;
  remote?: boolean;
  directOnly?: boolean;
  postedWithinDays?: number;
  providers?: string[];
  resultCount?: number;
};

export async function recordJobSearchHistory(
  input: JobSearchHistoryInput,
  auth: Pick<AuthContext, "userId" | "organizationId">,
) {
  const query = input.query.trim();
  if (!query) return;

  const postedWithinDays = Math.max(1, Math.min(Math.floor(input.postedWithinDays ?? 30), 90));
  const providers = Array.from(new Set((input.providers ?? []).filter(Boolean)));

  await getDb().execute(sql`
    INSERT INTO job_search_history (
      id, owner_id, organization_id, query, country_code, country, city,
      remote, direct_only, posted_within_days, providers, result_count, created_at
    ) VALUES (
      ${crypto.randomUUID()}, ${auth.userId}, ${auth.organizationId ?? null}, ${query},
      ${input.countryCode?.trim().toUpperCase() ?? null}, ${input.country?.trim() || null},
      ${input.city?.trim() || null}, ${input.remote ?? false}, ${input.directOnly ?? false},
      ${postedWithinDays}, ${JSON.stringify(providers)}::jsonb, ${Math.max(0, Math.floor(input.resultCount ?? 0))}, now()
    )
  `);
}

export async function listJobSearchHistory(
  auth: Pick<AuthContext, "userId" | "organizationId">,
  limit = 50,
) {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));
  const organizationCondition = auth.organizationId
    ? sql`AND organization_id = ${auth.organizationId}`
    : sql`AND organization_id IS NULL`;

  const result = await getDb().execute(sql`
    SELECT
      id,
      query,
      country_code AS "countryCode",
      country,
      city,
      remote,
      direct_only AS "directOnly",
      posted_within_days AS "postedWithinDays",
      providers,
      result_count AS "resultCount",
      created_at AS "createdAt"
    FROM job_search_history
    WHERE owner_id = ${auth.userId} ${organizationCondition}
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `);

  return result.rows;
}

export async function clearJobSearchHistory(
  auth: Pick<AuthContext, "userId" | "organizationId">,
) {
  const organizationCondition = auth.organizationId
    ? sql`AND organization_id = ${auth.organizationId}`
    : sql`AND organization_id IS NULL`;

  await getDb().execute(sql`
    DELETE FROM job_search_history
    WHERE owner_id = ${auth.userId} ${organizationCondition}
  `);
}
