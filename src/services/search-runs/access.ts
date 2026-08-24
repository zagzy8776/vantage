import { eq } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";

/**
 * Search runs predate the production tenant model, so ownership is kept in a
 * small side table instead of rewriting the canonical search_runs schema.
 * ownerId is nullable for legacy runs created before tenant isolation.
 */
export const searchRunAccess = pgTable(
  "search_run_access",
  {
    searchRunId: text("search_run_id").primaryKey(),
    ownerId: text("owner_id"),
    organizationId: text("organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIndex: index("search_run_access_owner_idx").on(table.ownerId),
    organizationIndex: index("search_run_access_org_idx").on(table.organizationId),
    ownerRunUnique: uniqueIndex("search_run_access_owner_run_unique").on(table.ownerId, table.searchRunId),
  })
);

export async function recordSearchRunOwner(input: {
  searchRunId: string;
  ownerId: string;
  organizationId?: string | null;
}): Promise<void> {
  await getDb().insert(searchRunAccess).values({
    searchRunId: input.searchRunId,
    ownerId: input.ownerId,
    organizationId: input.organizationId ?? null,
  });
}

export async function getSearchRunOwner(searchRunId: string) {
  return (await getDb()
    .select()
    .from(searchRunAccess)
    .where(eq(searchRunAccess.searchRunId, searchRunId))
    .limit(1))[0] ?? null;
}
