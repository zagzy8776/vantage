import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { searchRunAccess } from "@/lib/db/schema";
import type { AuthContext } from "@/auth/types";

export { searchRunAccess } from "@/lib/db/schema";

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

export async function getSearchWorkspaceId(searchRunId: string): Promise<string | null> {
  const row = await getSearchRunOwner(searchRunId);
  return row?.ownerId ?? null;
}

export async function canAccessSearchRun(searchRunId: string, auth: AuthContext): Promise<boolean> {
  const access = await getSearchRunOwner(searchRunId);
  if (!access) return false;
  if (access.ownerId === auth.userId) return true;
  if (access.organizationId && access.organizationId === auth.organizationId) {
    return ["owner", "admin", "analyst", "reviewer", "client"].includes(auth.role);
  }
  return false;
}

/**
 * A business is customer-visible only when it has been attached to at least
 * one search run that this customer can access. Global business records remain
 * shared internally, but customer APIs never expose them without this scope.
 */
export async function canAccessBusiness(businessId: string, auth: AuthContext): Promise<boolean> {
  const result = await getDb().execute(sql`
    SELECT 1
    FROM search_run_businesses srb
    INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
    WHERE srb.business_id = ${businessId}
      AND (
        sra.owner_id = ${auth.userId}
        OR (${auth.organizationId ?? null} IS NOT NULL AND sra.organization_id = ${auth.organizationId ?? null})
      )
    LIMIT 1
  `);
  return result.rows.length > 0;
}
