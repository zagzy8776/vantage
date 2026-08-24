/**
 * Production Hardening Phase 1B: User Issuance & Tenant Isolation
 *
 * Database-backed store for users, sessions, and investigation access.
 * All functions talk to Postgres via Drizzle/Neon. Callers must handle
 * failures - auth flows fail closed.
 */

import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  users,
  authSessions,
  investigationAccess,
  investigationShares,
  investigationSearchRuns,
  searchRunAccess,
} from "@/lib/db/schema";
import type { UserRole, Permission, AuthContext } from "./types";
import { hashPassword } from "./password";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string | null;
  passwordHash: string | null;
  isActive: boolean;
  emailVerified: boolean;
}

export interface SessionRecord {
  id: string;
  userId: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

export interface InvestigationAccessInfo {
  ownerId: string;
  organizationId: string | null;
  sharedWith: { userId: string; permission: Permission }[];
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    organizationId: row.organizationId ?? null,
    passwordHash: row.passwordHash ?? null,
    isActive: row.isActive,
    emailVerified: row.emailVerified,
  };
}

export async function countUsers(): Promise<number> {
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users);
  return rows.length;
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  organizationId?: string | null;
  emailVerified?: boolean;
}): Promise<StoredUser> {
  const db = getDb();
  const id = `user_${randomBytes(12).toString("hex")}`;
  const email = input.email.trim().toLowerCase();
  await db.insert(users).values({
    id,
    email,
    name: input.name,
    role: input.role,
    organizationId: input.organizationId ?? null,
    passwordHash: input.passwordHash,
    isActive: true,
    emailVerified: input.emailVerified ?? false,
  });
  return {
    id,
    email,
    name: input.name,
    role: input.role,
    organizationId: input.organizationId ?? null,
    passwordHash: null,
    isActive: true,
    emailVerified: input.emailVerified ?? false,
  };
}

export async function updatePendingSignupUser(input: {
  userId: string;
  name: string;
  passwordHash: string;
}): Promise<void> {
  const db = getDb();
  await db.update(users).set({
    name: input.name.trim(),
    passwordHash: input.passwordHash,
    isActive: true,
  }).where(eq(users.id, input.userId));
}

export async function recordSession(session: {
  id: string;
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
  expiresAt: Date;
}): Promise<void> {
  await getDb().insert(authSessions).values({
    id: session.id,
    userId: session.userId,
    email: session.email,
    role: session.role,
    organizationId: session.organizationId ?? null,
    revokedAt: null,
    expiresAt: session.expiresAt,
  });
}

export async function getSessionRecord(sessionId: string): Promise<SessionRecord | null> {
  const rows = await getDb().select({
    id: authSessions.id,
    userId: authSessions.userId,
    revokedAt: authSessions.revokedAt,
    expiresAt: authSessions.expiresAt,
  }).from(authSessions).where(eq(authSessions.id, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await getDb().update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, sessionId));
}

export async function touchLastLogin(userId: string): Promise<void> {
  await getDb().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

/** Persist the tenant owner for a newly created investigation. */
export async function recordInvestigationOwner(input: {
  investigationId: string;
  ownerId: string;
  organizationId?: string | null;
}): Promise<void> {
  await getDb().insert(investigationAccess).values({
    id: `ia_${randomBytes(12).toString("hex")}`,
    investigationId: input.investigationId,
    ownerId: input.ownerId,
    organizationId: input.organizationId ?? null,
  });
}

/**
 * Resolve who owns an investigation and how it is shared.
 *
 * Primary source is investigation_access. For legacy records created before
 * ownership was persisted, we safely infer ownership only when every linked
 * search run points to the same search-run owner. Ambiguous/ownerless legacy
 * records remain inaccessible rather than being assigned to the wrong tenant.
 */
export async function getInvestigationAccessInfo(investigationId: string): Promise<InvestigationAccessInfo | null> {
  const db = getDb();

  let accessRow = (await db.select().from(investigationAccess)
    .where(eq(investigationAccess.investigationId, investigationId)).limit(1))[0] ?? null;

  if (!accessRow) {
    const legacyRows = await db.select({
      ownerId: searchRunAccess.ownerId,
      organizationId: searchRunAccess.organizationId,
    })
      .from(investigationSearchRuns)
      .innerJoin(searchRunAccess, eq(searchRunAccess.searchRunId, investigationSearchRuns.searchRunId))
      .where(eq(investigationSearchRuns.investigationId, investigationId));

    const distinctOwners = Array.from(new Set(legacyRows.map((row) => row.ownerId).filter((id): id is string => Boolean(id))));
    if (distinctOwners.length === 1 && legacyRows.length > 0) {
      const ownerId = distinctOwners[0];
      const matchingOrg = legacyRows.find((row) => row.ownerId === ownerId)?.organizationId ?? null;
      await db.insert(investigationAccess).values({
        id: `ia_${randomBytes(12).toString("hex")}`,
        investigationId,
        ownerId,
        organizationId: matchingOrg,
      }).onConflictDoNothing({ target: investigationAccess.investigationId });
      accessRow = (await db.select().from(investigationAccess)
        .where(eq(investigationAccess.investigationId, investigationId)).limit(1))[0] ?? null;
    }
  }

  if (!accessRow) return null;

  const shareRows = await db.select({
    userId: investigationShares.userId,
    permission: investigationShares.permission,
  }).from(investigationShares)
    .where(eq(investigationShares.investigationAccessId, accessRow.id));

  return {
    ownerId: accessRow.ownerId,
    organizationId: accessRow.organizationId ?? null,
    sharedWith: shareRows.map((share) => ({
      userId: share.userId,
      permission: share.permission as Permission,
    })),
  };
}

/** Return investigation IDs visible to the authenticated tenant. */
export async function listAccessibleInvestigationIds(auth: AuthContext): Promise<string[]> {
  const rows = await getDb().select({ investigationId: investigationAccess.investigationId })
    .from(investigationAccess)
    .where(auth.organizationId
      ? eq(investigationAccess.organizationId, auth.organizationId)
      : eq(investigationAccess.ownerId, auth.userId));

  const ownerRows = await getDb().select({ investigationId: investigationAccess.investigationId })
    .from(investigationAccess)
    .where(eq(investigationAccess.ownerId, auth.userId));

  return Array.from(new Set([...rows, ...ownerRows].map((row) => row.investigationId)));
}

export async function ensureOwnerUser(): Promise<void> {
  const existing = await findUserByEmail("owner@vantage.local");
  if (existing) return;
  const password = process.env.VANTAGE_OWNER_PASSWORD ?? "change-me";
  const passwordHash = await hashPassword(password);
  await createUser({
    email: "owner@vantage.local",
    name: "Platform Owner",
    role: "owner",
    passwordHash,
    organizationId: undefined,
    emailVerified: true,
  });
}
