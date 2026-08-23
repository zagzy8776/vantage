/**
 * Production Hardening Phase 1: Authentication & Authorization
 * 
 * Service functions for user management, access control, and permissions.
 */

import { newId } from "@/lib/ids";
import type {
  User,
  UserRole,
  Permission,
  AccessResult,
  InvestigationAccess,
  Session,
  AuthContext,
} from "./types";

/**
 * Role hierarchy for permission inheritance
 * Higher roles include all permissions of lower roles
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 6,
  admin: 5,
  analyst: 4,
  reviewer: 3,
  researcher: 2,
  client: 1,
};

/**
 * Base permissions for each role
 */
const ROLE_PERMISSIONS: Record<UserRole, { canManageUsers: boolean; canManageBilling: boolean; canCreateInvestigations: boolean; canManageInvestigations: boolean; canSubmitEvidence: boolean; canReviewSubmissions: boolean; canViewAll: boolean }> = {
  owner: {
    canManageUsers: true,
    canManageBilling: true,
    canCreateInvestigations: true,
    canManageInvestigations: true,
    canSubmitEvidence: true,
    canReviewSubmissions: true,
    canViewAll: true,
  },
  admin: {
    canManageUsers: true,
    canManageBilling: false,
    canCreateInvestigations: true,
    canManageInvestigations: true,
    canSubmitEvidence: true,
    canReviewSubmissions: true,
    canViewAll: true,
  },
  analyst: {
    canManageUsers: false,
    canManageBilling: false,
    canCreateInvestigations: true,
    canManageInvestigations: true,
    canSubmitEvidence: true,
    canReviewSubmissions: false,
    canViewAll: false,
  },
  reviewer: {
    canManageUsers: false,
    canManageBilling: false,
    canCreateInvestigations: false,
    canManageInvestigations: false,
    canSubmitEvidence: false,
    canReviewSubmissions: true,
    canViewAll: false,
  },
  researcher: {
    canManageUsers: false,
    canManageBilling: false,
    canCreateInvestigations: false,
    canManageInvestigations: false,
    canSubmitEvidence: true,
    canReviewSubmissions: false,
    canViewAll: false,
  },
  client: {
    canManageUsers: false,
    canManageBilling: false,
    canCreateInvestigations: false,
    canManageInvestigations: false,
    canSubmitEvidence: false,
    canReviewSubmissions: false,
    canViewAll: false,
  },
};

/**
 * Create a new user
 */
export function createUser(
  email: string,
  name: string,
  role: UserRole,
  organizationId?: string
): User {
  return {
    id: newId(),
    email: email.toLowerCase(),
    name,
    role,
    organizationId,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
  };
}

/**
 * Update user role
 */
export function updateUserRole(user: User, newRole: UserRole): User {
  return {
    ...user,
    role: newRole,
    updatedAt: new Date(),
  };
}

/**
 * Deactivate user
 */
export function deactivateUser(user: User): User {
  return {
    ...user,
    isActive: false,
    updatedAt: new Date(),
  };
}

/**
 * Check if a role has permission to perform an action
 */
export function roleHasPermission(role: UserRole, permission: keyof typeof ROLE_PERMISSIONS[UserRole]): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/**
 * Check if user can manage another user (only higher roles can manage lower roles)
 */
export function canManageUser(manager: User, target: User): boolean {
  if (!manager.isActive) return false;
  const managerLevel = ROLE_HIERARCHY[manager.role];
  const targetLevel = ROLE_HIERARCHY[target.role];
  return managerLevel > targetLevel;
}

/**
 * Check if user can access a resource
 */
export function checkResourceAccess(
  user: User,
  resourceOwnerId: string,
  resourceOrganizationId: string | undefined,
  sharedWith: { userId: string; permission: Permission }[]
): AccessResult {
  if (!user.isActive) {
    return { allowed: false, permission: "none", reason: "User account is inactive" };
  }

  // Owner has full access
  if (user.id === resourceOwnerId) {
    return { allowed: true, permission: "admin" };
  }

  // Organization members have access if in same org
  if (resourceOrganizationId && user.organizationId === resourceOrganizationId) {
    return { allowed: true, permission: "write" };
  }

  // Check explicit sharing
  const shared = sharedWith.find(s => s.userId === user.id);
  if (shared) {
    return { allowed: true, permission: shared.permission };
  }

  // Owners and admins can view all resources
  if (user.role === "owner" || user.role === "admin") {
    return { allowed: true, permission: "read" };
  }

  return { allowed: false, permission: "none", reason: "No access permissions" };
}

/**
 * Check if user can perform a specific action on an investigation
 */
export function checkInvestigationAccess(
  user: User,
  investigationAccess: InvestigationAccess,
  requiredPermission: Permission
): AccessResult {
  const result = checkResourceAccess(
    user,
    investigationAccess.ownerId,
    investigationAccess.organizationId,
    investigationAccess.sharedWith
  );

  if (!result.allowed) {
    return result;
  }

  // Check if the granted permission meets the required permission
  const permissionLevels = { none: 0, read: 1, write: 2, admin: 3 };
  const grantedLevel = permissionLevels[result.permission];
  const requiredLevel = permissionLevels[requiredPermission];

  if (grantedLevel >= requiredLevel) {
    return result;
  }

  return {
    allowed: false,
    permission: result.permission,
    reason: `Insufficient permission: ${requiredPermission} required, but only ${result.permission} granted`,
  };
}

/**
 * Create a session for a user
 */
export function createSession(user: User, durationHours: number = 24): Session {
  const now = new Date();
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + durationHours * 60 * 60 * 1000),
  };
}

/**
 * Check if a session is valid
 */
export function isSessionValid(session: Session): boolean {
  return new Date() < session.expiresAt;
}

/**
 * Create auth context from session
 */
export function createAuthContext(session: Session): AuthContext {
  return {
    userId: session.userId,
    email: session.email,
    role: session.role,
    organizationId: session.organizationId,
  };
}

/**
 * Grant access to a resource for a user
 */
export function grantResourceAccess(
  investigationAccess: InvestigationAccess,
  userId: string,
  permission: Permission
): InvestigationAccess {
  const existingIndex = investigationAccess.sharedWith.findIndex(s => s.userId === userId);
  
  if (existingIndex >= 0) {
    // Update existing permission
    const updated = [...investigationAccess.sharedWith];
    updated[existingIndex] = { userId, permission };
    return {
      ...investigationAccess,
      sharedWith: updated,
      updatedAt: new Date(),
    };
  }

  // Add new permission
  return {
    ...investigationAccess,
    sharedWith: [...investigationAccess.sharedWith, { userId, permission }],
    updatedAt: new Date(),
  };
}

/**
 * Revoke access to a resource for a user
 */
export function revokeResourceAccess(
  investigationAccess: InvestigationAccess,
  userId: string
): InvestigationAccess {
  return {
    ...investigationAccess,
    sharedWith: investigationAccess.sharedWith.filter(s => s.userId !== userId),
    updatedAt: new Date(),
  };
}
