import { eq, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { searchRunAccess } from "@/lib/db/schema";
import type { AuthContext } from "@/auth/types";

export { searchRunAccess } from "@/lib/db/schema";

/** Shared guest id used before stable workspace cookies existed. */
export const LEGACY_ANON_OWNER_ID = "anon_unscoped";

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

/**
 * Owner ids a caller may read. Anonymous guests also see the legacy shared
 * workspace so older scans (pre stable cookie) still appear in History.
 */
export function visibleOwnerIds(auth: AuthContext): string[] {
  if (auth.isAnonymous) {
    return Array.from(new Set([auth.userId, LEGACY_ANON_OWNER_ID]));
  }
  return [auth.userId];
}

export function historyVisibilityFilter(auth: AuthContext) {
  if (auth.organizationId) {
    return or(
      eq(searchRunAccess.ownerId, auth.userId),
      eq(searchRunAccess.organizationId, auth.organizationId),
    );
  }
  if (auth.isAnonymous) {
    return or(
      eq(searchRunAccess.ownerId, auth.userId),
      eq(searchRunAccess.ownerId, LEGACY_ANON_OWNER_ID),
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

  const allowedOwners = new Set(visibleOwnerIds(auth));

  return rows.some((access) => {
    if (allowedOwners.has(access.ownerId)) return true;
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
  if (auth.isAnonymous) {
    return sql`(${sql.raw(ownerColumn)} = ${auth.userId} OR ${sql.raw(ownerColumn)} = ${LEGACY_ANON_OWNER_ID})`;
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
