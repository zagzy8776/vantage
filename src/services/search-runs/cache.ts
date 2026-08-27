import { and, desc, eq, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { searchRuns } from "@/lib/db/schema";
import type { DiscoveryQuery } from "@/providers/business/types";
import { recordSearchRunOwner } from "./access";
import { scopeDiscoveryResult } from "./scoping";

/** How long a completed scan can seed another guest without re-calling providers. */
const CACHE_TTL_MS = Number(process.env.DISCOVER_CACHE_TTL_MS) || 7 * 24 * 60 * 60_000;

function normalizeCity(city: string | null | undefined) {
  return (city ?? "").trim().toLowerCase() || null;
}

function fingerprint(query: DiscoveryQuery) {
  return {
    category: query.category.trim(),
    country: query.country.trim(),
    city: normalizeCity(query.city),
    depth: query.depth ?? "standard",
  };
}

/**
 * Find a recent completed scan with the same market fingerprint that still has results.
 * Used to avoid burning monthly Foursquare/Yelp/Firecrawl quota on identical searches.
 */
export async function findReusableCompletedRun(query: DiscoveryQuery) {
  const fp = fingerprint(query);
  const since = new Date(Date.now() - CACHE_TTL_MS);

  const rows = await getDb()
    .select()
    .from(searchRuns)
    .where(
      and(
        eq(searchRuns.query, fp.category),
        eq(searchRuns.country, fp.country),
        eq(searchRuns.depth, fp.depth),
        inArray(searchRuns.status, ["completed", "completed_with_errors"]),
        gte(searchRuns.createdAt, since),
        isNotNull(searchRuns.result),
        sql`coalesce(${searchRuns.discoveredCount}, 0) > 0`,
      ),
    )
    .orderBy(desc(searchRuns.completedAt), desc(searchRuns.createdAt))
    .limit(8);

  // City match: treat null/empty as the same "whole country" bucket.
  const match = rows.find((row) => normalizeCity(row.city) === fp.city);
  if (!match?.result || typeof match.result !== "object") return null;
  const results = Array.isArray((match.result as { results?: unknown }).results)
    ? ((match.result as { results: unknown[] }).results)
    : [];
  if (!results.length) return null;
  return match;
}

/** True when an identical scan is already queued/running (avoid stacking duplicate provider load). */
export async function findActiveMatchingRun(query: DiscoveryQuery) {
  const fp = fingerprint(query);
  const since = new Date(Date.now() - 45 * 60_000);

  const rows = await getDb()
    .select({
      id: searchRuns.id,
      status: searchRuns.status,
      city: searchRuns.city,
      createdAt: searchRuns.createdAt,
    })
    .from(searchRuns)
    .where(
      and(
        eq(searchRuns.query, fp.category),
        eq(searchRuns.country, fp.country),
        eq(searchRuns.depth, fp.depth),
        inArray(searchRuns.status, ["queued", "created", "running"]),
        gte(searchRuns.createdAt, since),
      ),
    )
    .orderBy(desc(searchRuns.createdAt))
    .limit(8);

  return rows.find((row) => normalizeCity(row.city) === fp.city) ?? null;
}

function newRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Fork a completed scan into a private run for this guest.
 * Applies owner-level "seen" filtering so repeat visitors get new businesses when possible.
 * No external provider calls.
 */
export async function forkCachedSearchRun(input: {
  sourceRunId: string;
  query: DiscoveryQuery;
  ownerId: string;
  organizationId?: string | null;
}) {
  const source = (
    await getDb().select().from(searchRuns).where(eq(searchRuns.id, input.sourceRunId)).limit(1)
  )[0];
  if (!source?.result) return null;

  const id = newRunId();
  const now = new Date();
  const limit = Math.max(1, Math.min(input.query.limit ?? 25, 250));

  await getDb().insert(searchRuns).values({
    id,
    query: input.query.category,
    country: input.query.country,
    city: input.query.city ?? null,
    depth: input.query.depth,
    queryExpansion: input.query.queryExpansion ? 1 : 0,
    evidenceEnrichment: input.query.evidenceEnrichment ? 1 : 0,
    searchSource: input.query.searchSource ?? null,
    status: "completed",
    stages: source.stages ?? {},
    failures: [],
    result: source.result as Record<string, unknown>,
    discoveredCount: source.discoveredCount ?? 0,
    enrichedCount: source.enrichedCount ?? 0,
    verifiedCount: source.verifiedCount ?? 0,
    createdAt: now,
    startedAt: now,
    completedAt: now,
    durationMs: 0,
  });

  await recordSearchRunOwner({
    searchRunId: id,
    ownerId: input.ownerId,
    organizationId: input.organizationId,
  });

  // Re-scope so this guest only sees businesses they have not already been shown.
  const scoped = await scopeDiscoveryResult(id, limit, source.result as Record<string, unknown>);

  await getDb()
    .update(searchRuns)
    .set({
      result: {
        ...scoped,
        workflow: {
          ...((scoped.workflow as object) ?? {}),
          cacheHit: true,
          cacheSourceRunId: input.sourceRunId,
          stage: "cached_reuse",
        },
      } as Record<string, unknown>,
      discoveredCount: scoped.totalUniqueResults,
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(searchRuns.id, id));

  return {
    runId: id,
    status: "completed" as const,
    cacheHit: true,
    sourceRunId: input.sourceRunId,
    resultCount: scoped.totalUniqueResults,
  };
}
