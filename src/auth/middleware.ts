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
} from "./user-store";

const PUBLIC_WORKSPACE_HEADER = "x-vantage-workspace-id";
const PUBLIC_WORKSPACE_COOKIE = "vantage_workspace";

function getSessionToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.substring(7);
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

function getAnonymousWorkspaceId(request: NextRequest) {
  return (
    request.headers.get(PUBLIC_WORKSPACE_HEADER)?.trim() ||
    request.cookies.get(PUBLIC_WORKSPACE_COOKIE)?.value?.trim() ||
    "anon_unscoped"
  );
}

/**
 * Public/pilot mode no longer impersonates the platform owner. Every browser
 * receives an isolated anonymous workspace identifier from src/middleware.ts.
 */
async function getPublicModeContext(request: NextRequest): Promise<AuthContext | null> {
  if (process.env.VANTAGE_PUBLIC_MODE !== "true") return null;
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
  const publicContext = await getPublicModeContext(request);
  if (publicContext) return publicContext;

  const token = getSessionToken(request);
  const session = verifySessionToken(token);
  if (!session?.sessionId) return null;

  let record;
  try {
    record = await getSessionRecord(session.sessionId);
  } catch {
    return null;
  }

  if (!record || record.revokedAt) return null;

  return {
    userId: session.userId,
    email: session.email,
    role: session.role,
    organizationId: session.organizationId,
    isAnonymous: false,
  };
}

export async function requireAuth(request: NextRequest): Promise<NextResponse | AuthContext> {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  return authContext;
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[],
): Promise<NextResponse | AuthContext> {
  const authContext = await requireAuth(request);
  if (authContext instanceof NextResponse) return authContext;
  if (!allowedRoles.includes(authContext.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  return authContext;
}

function authorize(
  authContext: AuthContext,
  resourceOwnerId: string,
  resourceOrganizationId: string | undefined,
  sharedWith: { userId: string; permission: Permission }[],
  requiredPermission: Permission,
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

  let accessInfo;
  try {
    accessInfo = await getInvestigationAccessInfo(investigationId);
  } catch {
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
    requiredPermission,
  );
  if (denied) return denied;
  return authContext;
}
