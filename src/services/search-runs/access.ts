import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { searchRunAccess } from "@/lib/db/schema";
import type { AuthContext } from "@/auth/types";

/**
 * Search run ownership lives in the canonical search_run_access table. The
 * table is defined in the DB schema/migrations so deployments and runtime use
 * the same Drizzle definition.
 */

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
