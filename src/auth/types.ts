/**
 * Production Hardening Phase 1: Authentication & Authorization
 * 
 * User accounts, roles, and resource ownership/access control.
 */

/**
 * User roles in the VANTAGE system
 */
export type UserRole = 
  | "owner"      // Full system access, can manage users and billing
  | "admin"      // Can manage investigations and team members
  | "analyst"    // Can create and manage investigations
  | "researcher" // Can submit evidence to marketplace tasks
  | "reviewer"   // Can review marketplace submissions
  | "client";    // Read-only access to assigned investigations

/**
 * User account
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string; // Optional: for team/enterprise accounts
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

/**
 * Resource ownership - applied to investigations, plans, reports, etc.
 */
export interface ResourceOwnership {
  ownerId: string; // User who owns the resource
  organizationId?: string; // Optional team ownership
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Permission levels for resources
 */
export type Permission = "read" | "write" | "admin" | "none";

/**
 * Access control result
 */
export interface AccessResult {
  allowed: boolean;
  permission: Permission;
  reason?: string;
}

/**
 * Investigation access control
 */
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

/**
 * Session data
 */
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
 * Auth context for API requests
 */
export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
}
