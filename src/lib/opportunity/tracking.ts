import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { entitySnapshots, opportunityEvents, trackedEntities } from "./schema";

export const OPPORTUNITY_TYPES = {
  SITE_PERFORMANCE_RECOVERY: "site_performance_recovery",
  REPUTATION_REPAIR: "reputation_repair",
  EXPANSION_VISIBILITY: "expansion_visibility",
} as const;

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[keyof typeof OPPORTUNITY_TYPES];

export interface OpportunityOwner {
  userId: string;
  organizationId?: string | null;
}

export interface OpportunitySnapshotInput {
  performanceScore?: number | null;
  reviewCount?: number | null;
  starRating?: number | null;
  openStatus?: boolean | null;
  category?: string | null;
  observedAt?: Date;
}

const MS_PER_DAY = 86_400_000;

function daysBetween(oldDate: Date, newDate: Date) {
  return Math.max(0, (newDate.getTime() - oldDate.getTime()) / MS_PER_DAY);
}

function changedCategory(oldValue: string | null, newValue: string | null) {
  if (!oldValue || !newValue) return false;
  const oldSet = new Set(oldValue.toLowerCase().split(/[,|]/).map((value) => value.trim()).filter(Boolean));
  const newSet = new Set(newValue.toLowerCase().split(/[,|]/).map((value) => value.trim()).filter(Boolean));
  for (const value of newSet) if (!oldSet.has(value)) return true;
  return false;
}

export interface DerivedOpportunity {
  type: OpportunityType;
  evidenceSentence: string;
}

export function deriveOpportunities(oldSnapshot: OpportunitySnapshotInput & { observedAt: Date }, nextSnapshot: OpportunitySnapshotInput & { observedAt: Date }): DerivedOpportunity[] {
  const elapsedDays = daysBetween(oldSnapshot.observedAt, nextSnapshot.observedAt);
  const opportunities: DerivedOpportunity[] = [];

  if (
    oldSnapshot.performanceScore != null &&
    nextSnapshot.performanceScore != null &&
    oldSnapshot.performanceScore - nextSnapshot.performanceScore >= 20 &&
    elapsedDays <= 30
  ) {
    opportunities.push({
      type: OPPORTUNITY_TYPES.SITE_PERFORMANCE_RECOVERY,
      evidenceSentence: `Performance score dropped from ${oldSnapshot.performanceScore} to ${nextSnapshot.performanceScore} over ${Math.max(1, Math.round(elapsedDays))} days.`,
    });
  }

  if (
    oldSnapshot.starRating != null &&
    nextSnapshot.starRating != null &&
    oldSnapshot.reviewCount != null &&
    nextSnapshot.reviewCount != null &&
    oldSnapshot.starRating - nextSnapshot.starRating >= 0.5 &&
    oldSnapshot.reviewCount > 0 &&
    nextSnapshot.reviewCount >= oldSnapshot.reviewCount * 1.5 &&
    elapsedDays <= 30
  ) {
    opportunities.push({
      type: OPPORTUNITY_TYPES.REPUTATION_REPAIR,
      evidenceSentence: `Rating dropped from ${oldSnapshot.starRating} to ${nextSnapshot.starRating} while reviews grew from ${oldSnapshot.reviewCount} to ${nextSnapshot.reviewCount} over ${Math.max(1, Math.round(elapsedDays))} days.`,
    });
  }

  if (nextSnapshot.openStatus === true && changedCategory(oldSnapshot.category ?? null, nextSnapshot.category ?? null)) {
    opportunities.push({
      type: OPPORTUNITY_TYPES.EXPANSION_VISIBILITY,
      evidenceSentence: `A new business category appeared while the business remained marked open: ${oldSnapshot.category ?? "none"} → ${nextSnapshot.category}.`,
    });
  }

  return opportunities;
}

function ownerFilter(owner: OpportunityOwner) {
  return owner.organizationId
    ? and(eq(trackedEntities.ownerId, owner.userId), eq(trackedEntities.organizationId, owner.organizationId))
    : eq(trackedEntities.ownerId, owner.userId);
}

export async function trackBusiness(businessId: string, owner: OpportunityOwner) {
  const db = getDb();
  const existing = await db.select().from(trackedEntities)
    .where(and(eq(trackedEntities.businessId, businessId), ownerFilter(owner)))
    .limit(1);
  if (existing[0]) {
    if (!existing[0].active) {
      return (await db.update(trackedEntities).set({ active: true }).where(and(eq(trackedEntities.id, existing[0].id), ownerFilter(owner))).returning())[0]!;
    }
    return existing[0];
  }
  const business = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!business[0]) throw new Error("Business not found.");
  return (await db.insert(trackedEntities).values({
    id: crypto.randomUUID(),
    businessId,
    ownerId: owner.userId,
    organizationId: owner.organizationId ?? null,
    active: true,
  }).returning())[0]!;
}

export async function untrackBusiness(businessId: string, owner: OpportunityOwner) {
  const db = getDb();
  return (await db.update(trackedEntities)
    .set({ active: false })
    .where(and(eq(trackedEntities.businessId, businessId), ownerFilter(owner)))
    .returning())[0] ?? null;
}

export async function recordBusinessSnapshot(businessId: string, input: OpportunitySnapshotInput, owner: OpportunityOwner) {
  const db = getDb();
  const tracked = await trackBusiness(businessId, owner);
  const observedAt = input.observedAt ?? new Date();
  const previous = await db.select().from(entitySnapshots)
    .where(eq(entitySnapshots.trackedEntityId, tracked.id))
    .orderBy(desc(entitySnapshots.observedAt))
    .limit(1);

  const inserted = (await db.insert(entitySnapshots).values({
    id: crypto.randomUUID(),
    trackedEntityId: tracked.id,
    observedAt,
    performanceScore: input.performanceScore ?? null,
    reviewCount: input.reviewCount ?? null,
    starRating: input.starRating == null ? null : String(input.starRating),
    openStatus: input.openStatus ?? null,
    category: input.category ?? null,
  }).returning())[0]!;

  await db.update(trackedEntities).set({ lastCheckedAt: observedAt }).where(and(eq(trackedEntities.id, tracked.id), ownerFilter(owner)));

  if (!previous[0]) return { snapshot: inserted, opportunities: [] };

  const opportunities = deriveOpportunities(
    { ...previous[0], starRating: previous[0].starRating == null ? null : Number(previous[0].starRating) },
    { ...inserted, starRating: inserted.starRating == null ? null : Number(inserted.starRating) },
  );

  const events = [];
  for (const opportunity of opportunities) {
    const event = (await db.insert(opportunityEvents).values({
      id: crypto.randomUUID(),
      trackedEntityId: tracked.id,
      oldSnapshotId: previous[0].id,
      newSnapshotId: inserted.id,
      opportunityType: opportunity.type,
      evidenceSentence: opportunity.evidenceSentence,
    }).onConflictDoNothing().returning())[0];
    if (event) events.push(event);
  }

  return { snapshot: inserted, opportunities: events };
}
