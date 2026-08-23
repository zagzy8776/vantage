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
} from "@/lib/db/schema";
import type { UserRole, Permission } from "./types";
import { hashPassword } from "./password";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string | null;
  passwordHash: string | null;
  isActive: boolean;
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

/**
 * Find an active or inactive user by email (case-insensitive)
 */
export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);

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
  };
}

/**
 * Count all users - used for first-run bootstrap decisions
 */
export async function countUsers(): Promise<number> {
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users);
  return rows.length;
}

/**
 * Create a user. Password must already be hashed via hashPassword().
 */
export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  organizationId?: string | null;
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
  });

  return {
    id,
    email,
    name: input.name,
    role: input.role,
    organizationId: input.organizationId ?? null,
    passwordHash: null, // never return credential material
    isActive: true,
  };
}

/**
 * Persist a session record so it can be revoked server-side
 */
export async function recordSession(session: {
  id: string;
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
  expiresAt: Date;
}): Promise<void> {
  const db = getDb();
  await db.insert(authSessions).values({
    id: session.id,
    userId: session.userId,
    email: session.email,
    role: session.role,
    organizationId: session.organizationId ?? null,
    revokedAt: null,
    expiresAt: session.expiresAt,
  });
}

/**
 * Get a session record for revocation checks.
 * Returns null when the session does not exist.
 */
export async function getSessionRecord(sessionId: string): Promise<SessionRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: authSessions.id,
      userId: authSessions.userId,
      revokedAt: authSessions.revokedAt,
      expiresAt: authSessions.expiresAt,
    })
    .from(authSessions)
    .where(eq(authSessions.id, sessionId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Revoke a session server-side (logout / admin action)
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, sessionId));
}

/**
 * Update last login timestamp (best-effort, non-blocking for callers)
 */
export async function touchLastLogin(userId: string): Promise<void> {
  const db = getDb();
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

/**
 * Resolve who owns an investigation and how it is shared.
 *
 * Resolution order:
 * 1. investigation_access + investigation_shares (explicit model)
 * 2. Legacy fallback: investigations.created_by as owner (no org, no shares)
 *
 * Returns null when neither source knows about the investigation.
 */
export async function getInvestigationAccessInfo(
  investigationId: string
): Promise<InvestigationAccessInfo | null> {
  const db = getDb();

  const accessRows = await db
    .select()
    .from(investigationAccess)
    .where(eq(investigationAccess.investigationId, investigationId))
    .limit(1);

  const ownerId: string | null = accessRows[0]?.ownerId ?? null;
  const organizationId: string | null = accessRows[0]?.organizationId ?? null;
  const accessRecordId: string | null = accessRows[0]?.id ?? null;

  if (!ownerId) {
    return null;
  }

  const sharedWith: { userId: string; permission: Permission }[] = [];
  if (accessRecordId) {
    const shareRows = await db
      .select({ userId: investigationShares.userId, permission: investigationShares.permission })
      .from(investigationShares)
      .where(eq(investigationShares.investigationAccessId, accessRecordId));

    for (const share of shareRows) {
      sharedWith.push({ userId: share.userId, permission: share.permission as Permission });
    }
  }

  return { ownerId, organizationId, sharedWith };
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
  });
}
