import { and, eq, or, isNull } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
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
 * Tenant-safe access check. Legacy ownerless runs are deliberately restricted
 * to platform owners/admins until explicitly associated with an account.
 */
export async function canAccessSearchRun(searchRunId: string, auth: AuthContext): Promise<boolean> {
  const access = await getSearchRunOwner(searchRunId);
  if (!access) return auth.role === "owner" || auth.role === "admin";
  if (access.ownerId === auth.userId) return true;
  if (access.organizationId && access.organizationId === auth.organizationId) {
    return ["owner", "admin", "analyst", "reviewer", "client"].includes(auth.role);
  }
  return auth.role === "owner";
}
