import { describe, it, expect } from "vitest";
import {
  createUser,
  updateUserRole,
  deactivateUser,
  roleHasPermission,
  canManageUser,
  checkResourceAccess,
  checkInvestigationAccess,
  createSession,
  isSessionValid,
  createAuthContext,
  grantResourceAccess,
  revokeResourceAccess,
} from "./service";
import type { Permission } from "./types";

describe("Auth Service", () => {
  describe("createUser", () => {
    it("creates a user with required fields", () => {
      const user = createUser("test@example.com", "Test User", "analyst");
      
      expect(user.id).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.role).toBe("analyst");
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it("lowercases email", () => {
      const user = createUser("TEST@EXAMPLE.COM", "Test", "analyst");
      expect(user.email).toBe("test@example.com");
    });

    it("includes organization ID when provided", () => {
      const user = createUser("test@example.com", "Test", "analyst", "org123");
      expect(user.organizationId).toBe("org123");
    });
  });

  describe("updateUserRole", () => {
    it("updates user role", () => {
      const user = createUser("test@example.com", "Test", "analyst");
      const originalTime = user.updatedAt.getTime();
      const updated = updateUserRole(user, "admin");
      
      expect(updated.role).toBe("admin");
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalTime);
    });
  });

  describe("deactivateUser", () => {
    it("deactivates user", () => {
      const user = createUser("test@example.com", "Test", "analyst");
      const deactivated = deactivateUser(user);
      
      expect(deactivated.isActive).toBe(false);
    });
  });

  describe("roleHasPermission", () => {
    it("returns correct permissions for each role", () => {
      expect(roleHasPermission("owner", "canManageUsers")).toBe(true);
      expect(roleHasPermission("owner", "canManageBilling")).toBe(true);
      expect(roleHasPermission("admin", "canManageUsers")).toBe(true);
      expect(roleHasPermission("admin", "canManageBilling")).toBe(false);
      expect(roleHasPermission("analyst", "canCreateInvestigations")).toBe(true);
      expect(roleHasPermission("analyst", "canManageUsers")).toBe(false);
      expect(roleHasPermission("researcher", "canSubmitEvidence")).toBe(true);
      expect(roleHasPermission("researcher", "canCreateInvestigations")).toBe(false);
      expect(roleHasPermission("reviewer", "canReviewSubmissions")).toBe(true);
      expect(roleHasPermission("reviewer", "canSubmitEvidence")).toBe(false);
      expect(roleHasPermission("client", "canViewAll")).toBe(false);
    });
  });

  describe("canManageUser", () => {
    it("allows higher roles to manage lower roles", () => {
      const owner = createUser("owner@example.com", "Owner", "owner");
      const admin = createUser("admin@example.com", "Admin", "admin");
      const analyst = createUser("analyst@example.com", "Analyst", "analyst");
      
      expect(canManageUser(owner, admin)).toBe(true);
      expect(canManageUser(owner, analyst)).toBe(true);
      expect(canManageUser(admin, analyst)).toBe(true);
    });

    it("prevents lower roles from managing higher roles", () => {
      const owner = createUser("owner@example.com", "Owner", "owner");
      const admin = createUser("admin@example.com", "Admin", "admin");
      const analyst = createUser("analyst@example.com", "Analyst", "analyst");
      
      expect(canManageUser(admin, owner)).toBe(false);
      expect(canManageUser(analyst, admin)).toBe(false);
    });

    it("prevents inactive users from managing anyone", () => {
      const inactiveAdmin = createUser("admin@example.com", "Admin", "admin");
      const deactivated = deactivateUser(inactiveAdmin);
      const analyst = createUser("analyst@example.com", "Analyst", "analyst");
      
      expect(canManageUser(deactivated, analyst)).toBe(false);
    });
  });

  describe("checkResourceAccess", () => {
    it("grants admin access to owner", () => {
      const owner = createUser("owner@example.com", "Owner", "analyst");
      const result = checkResourceAccess(owner, owner.id, undefined, []);
      
      expect(result.allowed).toBe(true);
      expect(result.permission).toBe("admin");
    });

    it("grants write access to organization members", () => {
      const orgMember = createUser("user@example.com", "User", "analyst", "org123");
      const result = checkResourceAccess(orgMember, "other-id", "org123", []);
      
      expect(result.allowed).toBe(true);
      expect(result.permission).toBe("write");
    });

    it("grants shared access with correct permission", () => {
      const user = createUser("user@example.com", "User", "analyst");
      const sharedWith = [{ userId: user.id, permission: "read" as Permission }];
      const result = checkResourceAccess(user, "owner-id", undefined, sharedWith);
      
      expect(result.allowed).toBe(true);
      expect(result.permission).toBe("read");
    });

    it("grants read access to owners and admins", () => {
      const owner = createUser("owner@example.com", "Owner", "owner");
      const result = checkResourceAccess(owner, "other-id", undefined, []);
      
      expect(result.allowed).toBe(true);
      expect(result.permission).toBe("read");
    });

    it("denies access to unauthorized users", () => {
      const user = createUser("user@example.com", "User", "analyst");
      const result = checkResourceAccess(user, "owner-id", undefined, []);
      
      expect(result.allowed).toBe(false);
      expect(result.permission).toBe("none");
      expect(result.reason).toBeDefined();
    });

    it("denies access to inactive users", () => {
      const user = createUser("user@example.com", "User", "analyst");
      const deactivated = deactivateUser(user);
      const result = checkResourceAccess(deactivated, deactivated.id, undefined, []);
      
      expect(result.allowed).toBe(false);
      expect(result.permission).toBe("none");
    });
  });

  describe("checkInvestigationAccess", () => {
    it("grants access when permission meets requirement", () => {
      const user = createUser("user@example.com", "User", "analyst");
      const investigationAccess = {
        investigationId: "inv1",
        ownerId: user.id,
        organizationId: undefined,
        sharedWith: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const result = checkInvestigationAccess(user, investigationAccess, "admin");
      expect(result.allowed).toBe(true);
    });

    it("denies access when permission insufficient", () => {
      const user = createUser("user@example.com", "User", "analyst");
      const investigationAccess = {
        investigationId: "inv1",
        ownerId: "other-id",
        organizationId: undefined,
        sharedWith: [{ userId: user.id, permission: "read" as Permission }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const result = checkInvestigationAccess(user, investigationAccess, "write");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Insufficient permission");
    });
  });

  describe("createSession", () => {
    it("creates a session with default 24 hour duration", () => {
      const user = createUser("test@example.com", "Test", "analyst");
      const session = createSession(user);
      
      expect(session.userId).toBe(user.id);
      expect(session.email).toBe(user.email);
      expect(session.role).toBe(user.role);
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("creates a session with custom duration", () => {
      const user = createUser("test@example.com", "Test", "analyst");
      const session = createSession(user, 1); // 1 hour
      
 const now = Date.now();
      const oneHourFromNow = now + 60 * 60 * 1000;
      expect(session.expiresAt.getTime()).toBeCloseTo(oneHourFromNow, 100);
    });
  });

  describe("isSessionValid", () => {
    it("returns true for valid session", () => {
      const user = createUser("test@example.com", "Test", "analyst");
      const session = createSession(user, 24);
      
      expect(isSessionValid(session)).toBe(true);
    });

    it("returns false for expired session", () => {
      const user = createUser("test@example.com", "Test", "analyst");
      const session = createSession(user, -1); // Expired
      
      expect(isSessionValid(session)).toBe(false);
    });
  });

  describe("createAuthContext", () => {
    it("creates auth context from session", () => {
      const user = createUser("test@example.com", "Test", "analyst", "org123");
      const session = createSession(user);
      const context = createAuthContext(session);
      
      expect(context.userId).toBe(user.id);
      expect(context.email).toBe(user.email);
      expect(context.role).toBe(user.role);
      expect(context.organizationId).toBe(user.organizationId);
    });
  });

  describe("grantResourceAccess", () => {
    it("grants access to new user", () => {
      const investigationAccess = {
        investigationId: "inv1",
        ownerId: "owner1",
        organizationId: undefined,
        sharedWith: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const updated = grantResourceAccess(investigationAccess, "user1", "read");
      
      expect(updated.sharedWith).toHaveLength(1);
      expect(updated.sharedWith[0].userId).toBe("user1");
      expect(updated.sharedWith[0].permission).toBe("read");
    });

    it("updates existing permission", () => {
      const investigationAccess = {
        investigationId: "inv1",
        ownerId: "owner1",
        organizationId: undefined,
        sharedWith: [{ userId: "user1", permission: "read" as Permission }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const updated = grantResourceAccess(investigationAccess, "user1", "write");
      
      expect(updated.sharedWith).toHaveLength(1);
      expect(updated.sharedWith[0].permission).toBe("write");
    });
  });

  describe("revokeResourceAccess", () => {
    it("revokes access from user", () => {
      const investigationAccess = {
        investigationId: "inv1",
        ownerId: "owner1",
        organizationId: undefined,
        sharedWith: [
          { userId: "user1", permission: "read" as Permission },
          { userId: "user2", permission: "write" as Permission },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const updated = revokeResourceAccess(investigationAccess, "user1");
      
      expect(updated.sharedWith).toHaveLength(1);
      expect(updated.sharedWith[0].userId).toBe("user2");
    });
  });
});
