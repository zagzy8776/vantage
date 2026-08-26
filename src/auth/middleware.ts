/**
 * Production Hardening Phase 1: Authentication & Authorization
 *
 * Middleware for API route authentication and authorization.
 */

import { NextRequest, NextResponse } from "next/server";
import type { AuthContext, User, UserRole, Permission } from "./types";
import { verifySessionToken, SESSION_COOKIE_NAME } from "./tokens";
import { checkResourceAccess } from "./service";
import { getSessionRecord, getInvestigationAccessInfo } from "./user-store";

const PUBLIC_WORKSPACE_HEADER = "x-vantage-workspace-id";
const PUBLIC_WORKSPACE_COOKIE = "vantage_workspace";

function getSessionToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.substring(7);
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

function getAnonymousWorkspaceId(request: NextRequest) {
  return request.headers.get(PUBLIC_WORKSPACE_HEADER)?.trim()
    || request.cookies.get(PUBLIC_WORKSPACE_COOKIE)?.value?.trim()
    || "anon_unscoped";
}

/**
 * Free-entry mode until the owner domain + email verification ship.
 * ON by default. Set VANTAGE_PUBLIC_MODE=false to require real sign-in again.
 */
function isPublicModeEnabled(): boolean {
  return process.env.VANTAGE_PUBLIC_MODE !== "false";
}

async function getPublicModeContext(request: NextRequest): Promise<AuthContext | null> {
  if (!isPublicModeEnabled()) return null;
  const workspaceId = getAnonymousWorkspaceId(request);
  return {
    userId: workspaceId,
    email: `guest+${workspaceId}@vantage.local`,
    role: "owner",
    organizationId: undefined,
    isAnonymous: true,
  };
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const token = getSessionToken(request);
  const session = verifySessionToken(token);

  if (token) {
    // A presented but invalid/revoked/deactivated session must never be silently
    // converted into an anonymous workspace. That could let a signed-out user
    // continue operating under pilot privileges.
    if (!session?.sessionId) return null;
    try {
      const record = await getSessionRecord(session.sessionId);
      if (!record || record.revokedAt || !record.isActive || record.userId !== session.userId || record.expiresAt <= new Date()) return null;
      return {
        userId: record.userId,
        email: record.email,
        role: record.role,
        organizationId: record.organizationId ?? undefined,
        isAnonymous: false,
      };
    } catch {
      return null;
    }
  }

  return getPublicModeContext(request);
}

export async function requireAuth(request: NextRequest): Promise<NextResponse | AuthContext> {
  const authContext = await getAuthContext(request);
  if (!authContext) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return authContext;
}

export async function requireRole(request: NextRequest, allowedRoles: UserRole[]): Promise<NextResponse | AuthContext> {
  const authContext = await requireAuth(request);
  if (authContext instanceof NextResponse) return authContext;
  if (!allowedRoles.includes(authContext.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  return authContext;
}

function authorize(
  authContext: AuthContext,
  resourceOwnerId: string,
  resourceOrganizationId: string | undefined,
  sharedWith: { userId: string; permission: Permission }[],
  requiredPermission: Permission,
): NextResponse | null {
  if (authContext.isAnonymous && authContext.userId !== resourceOwnerId) return NextResponse.json({ error: "Access denied to this resource" }, { status: 403 });

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
  if (!result.allowed || permissionLevels[result.permission] < permissionLevels[requiredPermission]) return NextResponse.json({ error: "Access denied to this resource" }, { status: 403 });
  return null;
}

export async function requireResourceAccess(
  request: NextRequest,
  resourceOwnerId: string,
  resourceOrganizationId: string | undefined,
  sharedWith: { userId: string; permission: Permission }[],
  requiredPermission: Permission = "read",
): Promise<NextResponse | AuthContext> {
  const authContext = await requireAuth(request);
  if (authContext instanceof NextResponse) return authContext;
  const denied = authorize(authContext, resourceOwnerId, resourceOrganizationId, sharedWith, requiredPermission);
  if (denied) return denied;
  return authContext;
}

export async function requireInvestigationAccess(
  request: NextRequest,
  investigationId: string,
  requiredPermission: Permission = "read",
): Promise<NextResponse | AuthContext> {
  const authContext = await requireAuth(request);
  if (authContext instanceof NextResponse) return authContext;

  try {
    const accessInfo = await getInvestigationAccessInfo(investigationId);
    if (!accessInfo) return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
    const denied = authorize(authContext, accessInfo.ownerId, accessInfo.organizationId ?? undefined, accessInfo.sharedWith, requiredPermission);
    if (denied) return denied;
    return authContext;
  } catch {
    return NextResponse.json({ error: "Access denied to this resource" }, { status: 403 });
  }
}
