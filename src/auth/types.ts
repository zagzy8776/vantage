/**
 * Production Hardening Phase 1: Authentication & Authorization
 * 
 * User accounts, roles, and resource ownership/access control.
 */

export type UserRole =
  | "owner"
  | "admin"
  | "analyst"
  | "researcher"
  | "reviewer"
  | "client";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

export interface ResourceOwnership {
  ownerId: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Permission = "read" | "write" | "admin" | "none";

export interface AccessResult {
  allowed: boolean;
  permission: Permission;
  reason?: string;
}

export interface InvestigationAccess {
  investigationId: string;
  ownerId: string;
  organizationId?: string;
  sharedWith: {
    userId: string;
    permission: Permission;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  sessionId?: string;
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Auth context for API requests.
 * isAnonymous is true only for the temporary public/pilot workspace mode.
 */
export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  isAnonymous?: boolean;
}
