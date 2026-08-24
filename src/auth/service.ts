/**
 * Production Hardening Phase 1: Authentication & Authorization
 *
 * Service functions for user management, access control, and permissions.
 */

import { newId } from "@/lib/ids";
import type { User, UserRole, Permission, AccessResult, InvestigationAccess, Session, AuthContext } from "./types";

const ROLE_HIERARCHY: Record<UserRole, number> = { owner: 6, admin: 5, analyst: 4, reviewer: 3, researcher: 2, client: 1 };

const ROLE_PERMISSIONS: Record<UserRole, { canManageUsers: boolean; canManageBilling: boolean; canCreateInvestigations: boolean; canManageInvestigations: boolean; canSubmitEvidence: boolean; canReviewSubmissions: boolean; canViewAll: boolean }> = {
  owner: { canManageUsers: true, canManageBilling: true, canCreateInvestigations: true, canManageInvestigations: true, canSubmitEvidence: true, canReviewSubmissions: true, canViewAll: true },
  admin: { canManageUsers: true, canManageBilling: false, canCreateInvestigations: true, canManageInvestigations: true, canSubmitEvidence: true, canReviewSubmissions: true, canViewAll: true },
  analyst: { canManageUsers: false, canManageBilling: false, canCreateInvestigations: true, canManageInvestigations: true, canSubmitEvidence: true, canReviewSubmissions: false, canViewAll: false },
  reviewer: { canManageUsers: false, canManageBilling: false, canCreateInvestigations: false, canManageInvestigations: false, canSubmitEvidence: false, canReviewSubmissions: true, canViewAll: false },
  researcher: { canManageUsers: false, canManageBilling: false, canCreateInvestigations: false, canManageInvestigations: false, canSubmitEvidence: true, canReviewSubmissions: false, canViewAll: false },
  client: { canManageUsers: false, canManageBilling: false, canCreateInvestigations: false, canManageInvestigations: false, canSubmitEvidence: false, canReviewSubmissions: false, canViewAll: false },
};

export function createUser(email: string, name: string, role: UserRole, organizationId?: string): User {
  return { id: newId(), email: email.toLowerCase(), name, role, organizationId, createdAt: new Date(), updatedAt: new Date(), isActive: true };
}

export function updateUserRole(user: User, newRole: UserRole): User {
  return { ...user, role: newRole, updatedAt: new Date() };
}

export function deactivateUser(user: User): User {
  return { ...user, isActive: false, updatedAt: new Date() };
}

export function roleHasPermission(role: UserRole, permission: keyof typeof ROLE_PERMISSIONS[UserRole]): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

export function canManageUser(manager: User, target: User): boolean {
  if (!manager.isActive) return false;
  return ROLE_HIERARCHY[manager.role] > ROLE_HIERARCHY[target.role];
}

/**
 * Resource access is tenant-scoped. Owner means owner of this resource, not a
 * platform-global superuser. Admin/owner roles only receive the capabilities
 * of their own organization through the organization branch below.
 */
export function checkResourceAccess(
  user: User,
  resourceOwnerId: string,
  resourceOrganizationId: string | undefined,
  sharedWith: { userId: string; permission: Permission }[]
): AccessResult {
  if (!user.isActive) return { allowed: false, permission: "none", reason: "User account is inactive" };
  if (user.id === resourceOwnerId) return { allowed: true, permission: "admin" };
  if (resourceOrganizationId && user.organizationId === resourceOrganizationId) return { allowed: true, permission: "write" };

  const shared = sharedWith.find((entry) => entry.userId === user.id);
  if (shared && shared.permission !== "none") return { allowed: true, permission: shared.permission };

  return { allowed: false, permission: "none", reason: "No access permissions" };
}

export function checkInvestigationAccess(user: User, investigationAccess: InvestigationAccess, requiredPermission: Permission): AccessResult {
  const result = checkResourceAccess(user, investigationAccess.ownerId, investigationAccess.organizationId, investigationAccess.sharedWith);
  if (!result.allowed) return result;
  const permissionLevels = { none: 0, read: 1, write: 2, admin: 3 };
  if (permissionLevels[result.permission] >= permissionLevels[requiredPermission]) return result;
  return { allowed: false, permission: result.permission, reason: `Insufficient permission: ${requiredPermission} required, but only ${result.permission} granted` };
}

export function createSession(user: User, durationHours: number = 24): Session {
  const now = new Date();
  return { userId: user.id, email: user.email, role: user.role, organizationId: user.organizationId, createdAt: now, expiresAt: new Date(now.getTime() + durationHours * 60 * 60 * 1000) };
}

export function isSessionValid(session: Session): boolean {
  return new Date() < session.expiresAt;
}

export function createAuthContext(session: Session): AuthContext {
  return { userId: session.userId, email: session.email, role: session.role, organizationId: session.organizationId };
}

export function grantResourceAccess(investigationAccess: InvestigationAccess, userId: string, permission: Permission): InvestigationAccess {
  const existingIndex = investigationAccess.sharedWith.findIndex((entry) => entry.userId === userId);
  if (existingIndex >= 0) {
    const updated = [...investigationAccess.sharedWith];
    updated[existingIndex] = { userId, permission };
    return { ...investigationAccess, sharedWith: updated, updatedAt: new Date() };
  }
  return { ...investigationAccess, sharedWith: [...investigationAccess.sharedWith, { userId, permission }], updatedAt: new Date() };
}

export function revokeResourceAccess(investigationAccess: InvestigationAccess, userId: string): InvestigationAccess {
  return { ...investigationAccess, sharedWith: investigationAccess.sharedWith.filter((entry) => entry.userId !== userId), updatedAt: new Date() };
}
