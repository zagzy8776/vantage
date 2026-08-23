/**
 * Production Hardening Phase 1: Authentication & Authorization
 *
 * Middleware for API route authentication and authorization.
 */

import { NextRequest, NextResponse } from "next/server";
import type { AuthContext, User, UserRole, Permission } from "./types";
import { verifySessionToken, SESSION_COOKIE_NAME } from "./tokens";
import { checkResourceAccess } from "./service";
import {
  getSessionRecord,
  getInvestigationAccessInfo,
  findUserByEmail,
} from "./user-store";

/**
 * Extract session token from request
 */
function getSessionToken(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Check cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (sessionCookie) {
    return sessionCookie.value;
  }

  return null;
}

/**
 * Get auth context from request.
 *
 * Verifies the HMAC-signed session token (see ./tokens). Returns null
 * for missing, malformed, tampered, or expired tokens - fail closed.
 */
/**
 * PUBLIC_ACCESS_MODE: a reversible, environment-gated switch that lets everyone
 * into the app without credentials. When VANTAGE_PUBLIC_MODE=true, this acts as
 * the platform owner so all protected routes and /api/auth/me work freely.
 *
 * This is intended for demo/pilot phases while email/auth is not yet provisioned.
 * Set VANTAGE_PUBLIC_MODE=false (or unset it) to restore real authentication -
 * no code change required. It never applies when the flag is absent.
 */
async function getPublicModeContext(): Promise<AuthContext | null> {
  if (process.env.VANTAGE_PUBLIC_MODE !== "true") return null;
  try {
    const owner = await findUserByEmail("owner@vantage.local");
    if (owner) {
      return {
        userId: owner.id,
        email: owner.email,
        role: owner.role,
        organizationId: owner.organizationId ?? undefined,
      };
    }
  } catch {
    // Fall through to the guest default below if the DB lookup fails.
  }
  return {
    userId: "public-guest",
    email: "guest@vantage.local",
    role: "owner",
    organizationId: undefined,
  };
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const publicContext = await getPublicModeContext();
  if (publicContext) return publicContext;

  const token = getSessionToken(request);
  const session = verifySessionToken(token);

  if (!session?.sessionId) {
    return null;
  }

  // Server-side session check: signature validity alone is not enough.
  // Fail closed - if the session record cannot be confirmed, reject.
  let record;
  try {
    record = await getSessionRecord(session.sessionId);
  } catch {
    return null;
  }

  if (!record || record.revokedAt) {
    return null;
  }

  return {
    userId: session.userId,
    email: session.email,
    role: session.role,
    organizationId: session.organizationId,
  };
}

/**
 * Require authentication - returns 401 if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<NextResponse | AuthContext> {
  const authContext = await getAuthContext(request);
  
  if (!authContext) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  
  return authContext;
}

/**
 * Require specific role - returns 403 if user doesn't have required role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<NextResponse | AuthContext> {
  const authContext = await requireAuth(request);
  
  if (authContext instanceof NextResponse) {
    return authContext;
  }
  
  if (!allowedRoles.includes(authContext.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }
  
  return authContext;
}

/**
 * Shared authorization decision: does this user meet the required
 * permission level on this resource?
 */
function authorize(
  authContext: AuthContext,
  resourceOwnerId: string,
  resourceOrganizationId: string | undefined,
  sharedWith: { userId: string; permission: Permission }[],
  requiredPermission: Permission
): NextResponse | null {
  const user: User = {
    id: authContext.userId,
    email: authContext.email,
    name: "",
    role: authContext.role,
    organizationId: authContext.organizationId,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
  };

  const result = checkResourceAccess(user, resourceOwnerId, resourceOrganizationId, sharedWith);

  const permissionLevels: Record<Permission, number> = { none: 0, read: 1, write: 2, admin: 3 };
  const grantedLevel = permissionLevels[result.permission];
  const requiredLevel = permissionLevels[requiredPermission];

  if (!result.allowed || grantedLevel < requiredLevel) {
    return NextResponse.json({ error: "Access denied to this resource" }, { status: 403 });
  }

  return null;
}

/**
 * Check if user can access a specific resource.
 *
 * Enforces the VANTAGE access model via checkResourceAccess():
 * owner (admin) > same organization (write) > explicit share > platform admin/owner (read).
 * The granted permission must also meet the required permission level.
 */
export async function requireResourceAccess(
  request: NextRequest,
  resourceOwnerId: string,
  resourceOrganizationId: string | undefined,
  sharedWith: { userId: string; permission: Permission }[],
  requiredPermission: Permission = "read"
): Promise<NextResponse | AuthContext> {
  const authContext = await requireAuth(request);

  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const denied = authorize(authContext, resourceOwnerId, resourceOrganizationId, sharedWith, requiredPermission);
  if (denied) {
    return denied;
  }

  return authContext;
}

/**
 * Tenant-isolation guard for investigation-owned resources.
 *
 * Resolves ownership/sharing from the database (with legacy fallback to
 * investigations.created_by) and enforces the required permission.
 * Returns 404 for unknown investigations (does not leak existence),
 * 401 when unauthenticated and 403 on permission failure.
 */
export async function requireInvestigationAccess(
  request: NextRequest,
  investigationId: string,
  requiredPermission: Permission = "read"
): Promise<NextResponse | AuthContext> {
  const authContext = await requireAuth(request);

  if (authContext instanceof NextResponse) {
    return authContext;
  }

  let accessInfo;
  try {
    accessInfo = await getInvestigationAccessInfo(investigationId);
  } catch {
    // Fail closed - cannot confirm access means no access
    return NextResponse.json({ error: "Access denied to this resource" }, { status: 403 });
  }

  if (!accessInfo) {
    return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
  }

  const denied = authorize(
    authContext,
    accessInfo.ownerId,
    accessInfo.organizationId ?? undefined,
    accessInfo.sharedWith,
    requiredPermission
  );
  if (denied) {
    return denied;
  }

  return authContext;
}

/**
 * Auth helper for API routes
 * Usage:
 * 
 * export async function GET(request: NextRequest) {
 *   const auth = await requireAuth(request);
 *   if (auth instanceof NextResponse) return auth;
 *   
 *   // Proceed with authenticated request
 * }
 */
