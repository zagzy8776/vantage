import { eq, or, sql } from "drizzle-orm";
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
  return (
    (
      await getDb()
        .select()
        .from(searchRunAccess)
        .where(eq(searchRunAccess.searchRunId, searchRunId))
        .limit(1)
    )[0] ?? null
  );
}

export async function getSearchWorkspaceId(searchRunId: string): Promise<string | null> {
  const row = await getSearchRunOwner(searchRunId);
  return row?.ownerId ?? null;
}

/** History is private: each guest only sees scans they started. */
export function historyVisibilityFilter(auth: AuthContext) {
  if (auth.organizationId) {
    return or(
      eq(searchRunAccess.ownerId, auth.userId),
      eq(searchRunAccess.organizationId, auth.organizationId),
    );
  }
  return eq(searchRunAccess.ownerId, auth.userId);
}

export async function canAccessSearchRun(
  searchRunId: string,
  auth: AuthContext,
): Promise<boolean> {
  const rows = await getDb()
    .select({ ownerId: searchRunAccess.ownerId, organizationId: searchRunAccess.organizationId })
    .from(searchRunAccess)
    .where(eq(searchRunAccess.searchRunId, searchRunId));

  return rows.some((access) => {
    if (access.ownerId === auth.userId) return true;
    if (access.organizationId && access.organizationId === auth.organizationId) {
      return ["owner", "admin", "analyst", "reviewer", "client"].includes(auth.role);
    }
    return false;
  });
}

function tenantVisibilitySql(auth: AuthContext, ownerColumn: string, organizationColumn: string) {
  if (auth.organizationId) {
    return sql`${sql.raw(ownerColumn)} = ${auth.userId} OR ${sql.raw(organizationColumn)} = ${auth.organizationId}`;
  }
  return sql`${sql.raw(ownerColumn)} = ${auth.userId}`;
}

export async function canAccessBusiness(businessId: string, auth: AuthContext): Promise<boolean> {
  const visibility = tenantVisibilitySql(auth, "sra.owner_id", "sra.organization_id");
  const result = await getDb().execute(sql`
    SELECT 1
    FROM search_run_businesses srb
    INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
    WHERE srb.business_id = ${businessId}
      AND (${visibility})
    LIMIT 1
  `);
  return result.rows.length > 0;
}

export async function canAccessLead(leadId: string, auth: AuthContext): Promise<boolean> {
  const visibility = tenantVisibilitySql(auth, "sra.owner_id", "sra.organization_id");
  const result = await getDb().execute(sql`
    SELECT 1
    FROM leads l
    INNER JOIN search_run_businesses srb ON srb.business_id = l.business_id
    INNER JOIN search_run_access sra ON sra.search_run_id = srb.search_run_id
    WHERE l.id = ${leadId}
      AND (${visibility})
    LIMIT 1
  `);
  return result.rows.length > 0;
}
