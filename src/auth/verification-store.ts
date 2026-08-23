/**
 * Email verification - database persistence.
 *
 * All functions talk to Postgres via Drizzle/Neon following the conventions
 * of ./user-store. Callers handle failures - auth flows fail closed.
 */

import { randomBytes } from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { emailVerifications, organizations, users } from "@/lib/db/schema";
import type { VerificationRecord } from "./verification";

/** Insert a fresh verification record (old pending rows are removed first). */
export async function insertVerification(input: {
  userId: string;
  codeHash: string;
  expiresAt: Date;
}): Promise<void> {
  const db = getDb();
  await db
    .delete(emailVerifications)
    .where(and(eq(emailVerifications.userId, input.userId), isNull(emailVerifications.verifiedAt)));

  await db.insert(emailVerifications).values({
    id: `ver_${randomBytes(12).toString("hex")}`,
    userId: input.userId,
    codeHash: input.codeHash,
    expiresAt: input.expiresAt,
    attempts: 0,
    verifiedAt: null,
  });
}

/** Most recent un-verified verification record for a user, if any. */
export async function findLatestPendingVerification(
  userId: string
): Promise<VerificationRecord | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(emailVerifications)
    .where(and(eq(emailVerifications.userId, userId), isNull(emailVerifications.verifiedAt)))
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    codeHash: row.codeHash,
    expiresAt: row.expiresAt,
    attempts: row.attempts,
    verifiedAt: row.verifiedAt ?? null,
    createdAt: row.createdAt,
  };
}

export async function incrementVerificationAttempts(verificationId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ attempts: emailVerifications.attempts })
    .from(emailVerifications)
    .where(eq(emailVerifications.id, verificationId))
    .limit(1);
  const current = rows[0]?.attempts ?? 0;
  await db
    .update(emailVerifications)
    .set({ attempts: current + 1 })
    .where(eq(emailVerifications.id, verificationId));
}

export async function markVerificationVerified(verificationId: string): Promise<void> {
  const db = getDb();
  await db
    .update(emailVerifications)
    .set({ verifiedAt: new Date() })
    .where(eq(emailVerifications.id, verificationId));
}

/**
 * Activate the account after successful verification and create the user's
 * workspace (organization). The user becomes Owner of that workspace.
 * Users who already belong to an organization keep it untouched.
 */
export async function activateUserWithWorkspace(input: {
  userId: string;
  name: string;
}): Promise<{ organizationId: string; role: "owner" }> {
  const db = getDb();

  const existingRows = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  let organizationId = existingRows[0]?.organizationId ?? null;

  if (!organizationId) {
    organizationId = `org_${randomBytes(12).toString("hex")}`;
    await db.insert(organizations).values({
      id: organizationId,
      name: `${input.name.trim()}'s Workspace`,
      plan: "free",
    });
  }

  await db
    .update(users)
    .set({ emailVerified: true, isActive: true, role: "owner", organizationId })
    .where(eq(users.id, input.userId));

  return { organizationId, role: "owner" };
}
