import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchCurrentUser,
  login,
  logout,
  resolveSafeRedirect,
  getUserInitials,
} from "./auth-client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("auth client (PH1C)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchCurrentUser", () => {
    it("parses the safe identity on success", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          user: { id: "user-1", email: "a@b.c", name: "Zagzy Owner", role: "owner" },
        })
      );

      const user = await fetchCurrentUser();
      expect(user).toEqual({
        id: "user-1",
        email: "a@b.c",
        name: "Zagzy Owner",
        role: "owner",
        organizationId: undefined,
      });
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", { cache: "no-store" });
    });

    it("returns null on 401 instead of throwing", async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { error: "Authentication required" }));
      await expect(fetchCurrentUser()).resolves.toBeNull();
    });

    it("throws a safe message on server errors", async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, {}));
      await expect(fetchCurrentUser()).rejects.toThrow("Unable to confirm your session");
    });
  });

  describe("login", () => {
    it("succeeds and relies on the server-issued cookie", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { user: {} }));
      const result = await login("owner@vantage.local", "correct-password");
      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("maps invalid credentials to the generic error", async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { error: "Invalid email or password" }));
      const result = await login("owner@vantage.local", "wrong");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Invalid email or password.");
    });

    it("maps rate limiting to its own message", async () => {
      fetchMock.mockResolvedValue(jsonResponse(429, { error: "Too many attempts." }));
      const result = await login("owner@vantage.local", "wrong");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Too many attempts");
    });

    it("maps unexpected failures to a generic server message", async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, {}));
      const result = await login("owner@vantage.local", "whatever");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("temporarily unavailable");
    });
  });

  describe("logout", () => {
    it("posts to the backend logout endpoint", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));
      await expect(logout()).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    });

    it("resolves even when the network call fails", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      await expect(logout()).resolves.toBeUndefined();
    });
  });

  describe("resolveSafeRedirect", () => {
    it("accepts same-origin relative paths including query strings", () => {
      expect(resolveSafeRedirect("/investigations/new")).toBe("/investigations/new");
      expect(resolveSafeRedirect("/leads/abc?tab=analysis")).toBe("/leads/abc?tab=analysis");
      expect(resolveSafeRedirect(encodeURIComponent("/discover?x=1"))).toBe("/discover?x=1");
    });

    it("falls back for absolute and protocol-relative URLs", () => {
      expect(resolveSafeRedirect("https://evil.com")).not.toBe("https://evil.com");
      expect(resolveSafeRedirect("//evil.com")).toBe("/investigations");
      expect(resolveSafeRedirect("/\\evil.com")).toBe("/investigations");
    });

    it("falls back for malformed or empty values", () => {
      expect(resolveSafeRedirect(null)).toBe("/investigations");
      expect(resolveSafeRedirect(undefined)).toBe("/investigations");
      expect(resolveSafeRedirect("")).toBe("/investigations");
      expect(resolveSafeRedirect("%zz")).toBe("/investigations");
      expect(resolveSafeRedirect("login")).toBe("/investigations");
    });

    it("honours a custom fallback", () => {
      expect(resolveSafeRedirect(null, "/")).toBe("/");
    });
  });

  describe("getUserInitials", () => {
    it("derives initials from a full name", () => {
      expect(getUserInitials({ name: "Zagzy Owner", email: "" })).toBe("ZO");
    });

    it("falls back to the email local part", () => {
      expect(getUserInitials({ name: "", email: "zagzy@vantage.local" })).toBe("ZV");
    });

    it("handles single-word names", () => {
      expect(getUserInitials({ name: "Zagzy", email: "" })).toBe("ZA");
    });
  });
});
