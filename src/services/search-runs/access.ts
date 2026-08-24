import { eq, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { AuthContext } from "@/auth/types";

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

/**
 * A platform owner is the only account without an organization and may inspect
 * legacy/unowned data. A normal organization owner is still tenant-scoped.
 */
function isPlatformOwner(auth: AuthContext): boolean {
  return auth.role === "owner" && !auth.organizationId;
}

export async function canAccessSearchRun(searchRunId: string, auth: AuthContext): Promise<boolean> {
  const access = await getSearchRunOwner(searchRunId);
  if (!access) return isPlatformOwner(auth);
  if (access.ownerId === auth.userId) return true;
  if (access.organizationId && access.organizationId === auth.organizationId) {
    return ["owner", "admin", "analyst", "reviewer", "client"].includes(auth.role);
  }
  return isPlatformOwner(auth);
}
