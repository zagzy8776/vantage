import { boolean, decimal, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { businesses } from "@/lib/db/schema";

export const trackedEntities = pgTable("tracked_entities", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(),
  organizationId: text("organization_id"),
  active: boolean("active").notNull().default(true),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true, mode: "date" }),
}, (table) => ({
  businessOwnerUnique: uniqueIndex("tracked_entities_business_owner_unique").on(table.businessId, table.ownerId),
  activeIndex: index("tracked_entities_active_idx").on(table.active),
  lastCheckedIndex: index("tracked_entities_last_checked_idx").on(table.lastCheckedAt),
  ownerIndex: index("tracked_entities_owner_idx").on(table.ownerId),
  organizationIndex: index("tracked_entities_organization_idx").on(table.organizationId),
}));

export const entitySnapshots = pgTable("entity_snapshots", {
  id: text("id").primaryKey(),
  trackedEntityId: text("tracked_entity_id").notNull().references(() => trackedEntities.id, { onDelete: "cascade" }),
  observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  performanceScore: integer("performance_score"),
  reviewCount: integer("review_count"),
  starRating: decimal("star_rating", { precision: 3, scale: 2 }),
  openStatus: boolean("open_status"),
  category: text("category"),
}, (table) => ({
  trackedObservedIndex: index("entity_snapshots_tracked_observed_idx").on(table.trackedEntityId, table.observedAt),
}));

export const opportunityEvents = pgTable("opportunity_events", {
  id: text("id").primaryKey(),
  trackedEntityId: text("tracked_entity_id").notNull().references(() => trackedEntities.id, { onDelete: "cascade" }),
  oldSnapshotId: text("old_snapshot_id").notNull().references(() => entitySnapshots.id, { onDelete: "cascade" }),
  newSnapshotId: text("new_snapshot_id").notNull().references(() => entitySnapshots.id, { onDelete: "cascade" }),
  opportunityType: text("opportunity_type").notNull(),
  evidenceSentence: text("evidence_sentence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  trackedCreatedIndex: index("opportunity_events_tracked_created_idx").on(table.trackedEntityId, table.createdAt),
  typeIndex: index("opportunity_events_type_idx").on(table.opportunityType),
  transitionUnique: uniqueIndex("opportunity_events_transition_unique").on(table.trackedEntityId, table.oldSnapshotId, table.newSnapshotId, table.opportunityType),
}));
