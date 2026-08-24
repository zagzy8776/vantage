import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { searchRunAccess } from "@/lib/db/schema";
import type { AuthContext } from "@/auth/types";

// Keep the table export available to the discovery history route while using
// the canonical schema definition for migrations and runtime queries.
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

/**
 * Search results are private research assets.
 *
 * A missing access row means the run is legacy/unowned data. It must not be
 * exposed to customers, including the platform owner, because doing so makes
 * old/demo searches appear in a fresh workspace. Legacy data can be inspected
 * through an explicit internal migration/admin path instead of normal customer
 * discovery history.
 */
export async function canAccessSearchRun(searchRunId: string, auth: AuthContext): Promise<boolean> {
  const access = await getSearchRunOwner(searchRunId);
  if (!access) return false;

  if (access.ownerId === auth.userId) return true;

  if (access.organizationId && access.organizationId === auth.organizationId) {
    return ["owner", "admin", "analyst", "reviewer", "client"].includes(auth.role);
  }

  return false;
}
