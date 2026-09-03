import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { businesses, websiteAnalyses } from "@/lib/db/schema";
import { providerRegistry } from "@/providers/business/registry";
import type { DiscoveryQuery, NormalizedBusiness } from "@/providers/business/types";
import { trackedEntities } from "./schema";
import { recordBusinessSnapshot } from "./tracking";

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesBusiness(candidate: NormalizedBusiness, business: typeof businesses.$inferSelect) {
  const name = normalize(business.name);
  const candidateName = normalize(candidate.name);
  if (!name || !candidateName) return false;
  const exactName = name === candidateName || candidateName.includes(name) || name.includes(candidateName);
  if (!exactName) return false;
  if (business.city && candidate.city) return normalize(business.city) === normalize(candidate.city);
  if (business.latitude != null && business.longitude != null && candidate.latitude != null && candidate.longitude != null) {
    return Math.abs(Number(business.latitude) - candidate.latitude) < 0.01 && Math.abs(Number(business.longitude) - candidate.longitude) < 0.01;
  }
  return !business.city && !candidate.city;
}

async function refreshFromProvider(business: typeof businesses.$inferSelect) {
  const base: DiscoveryQuery = {
    category: business.category,
    country: business.country ?? "",
    region: business.region ?? undefined,
    city: business.city ?? undefined,
    area: business.area ?? undefined,
    street: business.street ?? undefined,
    latitude: business.latitude == null ? undefined : Number(business.latitude),
    longitude: business.longitude == null ? undefined : Number(business.longitude),
    limit: 10,
    depth: "quick",
    queryExpansion: false,
    evidenceEnrichment: false,
  };

  for (const providerName of ["foursquare", "yelp"] as const) {
    try {
      const result = await providerRegistry[providerName].search(base);
      const match = result.results.find((candidate) => matchesBusiness(candidate, business));
      if (match) return match;
    } catch {
      // A failed provider should not prevent the other provider or local snapshot.
    }
  }
  return undefined;
}

export async function refreshTrackedBusinesses(options: { limit?: number } = {}) {
  const db = getDb();
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const tracked = await db.select({ tracked: trackedEntities, business: businesses })
    .from(trackedEntities)
    .innerJoin(businesses, eq(trackedEntities.businessId, businesses.id))
    .where(eq(trackedEntities.active, true))
    .orderBy(trackedEntities.lastCheckedAt)
    .limit(limit);

  let checked = 0;
  let changed = 0;
  let errors = 0;

  for (const row of tracked) {
    try {
      const current = await refreshFromProvider(row.business);
      const latestAnalysis = row.business.website
        ? await db.select({ performanceScore: websiteAnalyses.performanceScore })
          .from(websiteAnalyses)
          .where(eq(websiteAnalyses.businessId, row.business.id))
          .orderBy(desc(websiteAnalyses.analyzedAt))
          .limit(1)
        : [];
      const result = await recordBusinessSnapshot(row.business.id, {
        performanceScore: latestAnalysis[0]?.performanceScore ?? null,
        reviewCount: current?.reviewCount ?? row.business.reviewCount ?? null,
        starRating: current?.rating ?? (row.business.rating == null ? null : Number(row.business.rating)),
        // The current providers do not expose a verified open/closed field.
        // Null means unknown; the opportunity engine must never infer "open".
        openStatus: null,
        category: current?.category ?? row.business.category,
      }, {
        userId: row.tracked.ownerId,
        organizationId: row.tracked.organizationId,
      });
      checked += 1;
      changed += result.opportunities.length;
    } catch {
      errors += 1;
    }
  }

  return { checked, opportunitiesCreated: changed, errors };
}
