import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getSearchRunOwner } from "./access";

type RawBusiness = {
  externalId?: string;
  source?: string;
  name?: string;
  [key: string]: unknown;
};

type ScopedResult = Record<string, unknown> & {
  results: RawBusiness[];
  resultSources: unknown[];
  storedIds: string[];
  totalUniqueResults: number;
  workflow?: Record<string, unknown>;
};

function businessIdFor(business: RawBusiness) {
  if (typeof business.externalId !== "string" || typeof business.source !== "string") return null;
  return `biz_${business.source}_${business.externalId}`;
}

function leadIdFor(businessId: string) {
  const match = businessId.match(/^biz_(.+)_(.+)$/);
  if (!match) return null;
  return `lead_${match[1]}_${match[2]}`;
}

export async function scopeDiscoveryResult(
  runId: string,
  requestedLimit: number,
  rawResult: Record<string, unknown>,
) {
  const owner = await getSearchRunOwner(runId);
  const ownerId = owner?.ownerId;
  if (!ownerId) {
    return { ...rawResult, results: [], resultSources: [], storedIds: [], totalUniqueResults: 0 } as ScopedResult;
  }

  const rawResults = Array.isArray(rawResult.results) ? rawResult.results as RawBusiness[] : [];
  const rawSources = Array.isArray(rawResult.resultSources) ? rawResult.resultSources : [];

  const candidates = rawResults
    .map((business, index) => ({ business, index, businessId: businessIdFor(business) }))
    .filter((item): item is { business: RawBusiness; index: number; businessId: string } => Boolean(item.businessId));

  if (!candidates.length) {
    return { ...rawResult, results: [], resultSources: [], storedIds: [], totalUniqueResults: 0 } as ScopedResult;
  }

  const candidateIds = candidates.map((item) => item.businessId);
  const values = candidateIds.map((id) => sql`${id}`);
  const seenQuery = sql`
    SELECT business_id
    FROM search_run_seen_businesses
    WHERE owner_id = ${ownerId}
      AND business_id IN (${sql.join(values, sql`, `)})
  `;
  const seenRows = await getDb().execute(seenQuery);
  const seen = new Set(seenRows.rows.map((row) => String((row as { business_id: string }).business_id)));

  const visible = candidates.filter((item) => !seen.has(item.businessId)).slice(0, Math.max(0, requestedLimit));
  const visibleBusinessIds = visible.map((item) => item.businessId);
  const visibleLeadIds = visibleBusinessIds.map(leadIdFor).filter((id): id is string => Boolean(id));

  if (visibleBusinessIds.length) {
    const runValues = visibleBusinessIds.map((id) => sql`(${runId}, ${id})`);
    await getDb().execute(sql`
      INSERT INTO search_run_businesses (search_run_id, business_id)
      VALUES ${sql.join(runValues, sql`, `)}
      ON CONFLICT (search_run_id, business_id) DO NOTHING
    `);

    const seenValues = visibleBusinessIds.map((id) => sql`(${ownerId}, ${id}, ${runId})`);
    await getDb().execute(sql`
      INSERT INTO search_run_seen_businesses (owner_id, business_id, first_search_run_id)
      VALUES ${sql.join(seenValues, sql`, `)}
      ON CONFLICT (owner_id, business_id) DO NOTHING
    `);
  }

  const result = {
    ...rawResult,
    results: visible.map((item) => item.business),
    resultSources: visible.map((item) => rawSources[item.index] ?? []),
    storedIds: visibleLeadIds,
    totalUniqueResults: visible.length,
  } as ScopedResult;

  return result;
}
