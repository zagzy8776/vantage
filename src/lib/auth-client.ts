/**
 * Frontend auth client (PH1C)
 *
 * Thin typed wrapper around the backend session endpoints. The browser
 * never sees or stores the session token - the HttpOnly cookie issued by
 * POST /api/auth/login is the single source of authentication state.
 */

export type UserRole =
  | "owner"
  | "admin"
  | "analyst"
  | "researcher"
  | "reviewer"
  | "client";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string;
}

export const LOGIN_PATH = "/login";
const DEFAULT_REDIRECT = "/investigations";

function parseUser(payload: unknown): CurrentUser | null {
  if (!payload || typeof payload !== "object") return null;
  const user = (payload as { user?: Partial<CurrentUser> }).user;
  if (!user || typeof user.id !== "string" || typeof user.email !== "string" || typeof user.name !== "string" || typeof user.role !== "string") return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    organizationId: typeof user.organizationId === "string" ? user.organizationId : undefined,
  };
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetch("/api/auth/me", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Unable to confirm your session. Please try again.");
  return parseUser(await response.json().catch(() => null));
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  needsVerification?: boolean;
  email?: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (response.ok) return { ok: true };
  if (response.status === 403) {
    const payload = await response.json().catch(() => null);
    if (payload?.code === "EMAIL_NOT_VERIFIED") return { ok: false, needsVerification: true, error: payload.error, email: payload.email };
    return { ok: false, error: "Sign-in is temporarily unavailable. Please try again." };
  }
  if (response.status === 401 || response.status === 400) return { ok: false, error: "Invalid email or password." };
  if (response.status === 429) return { ok: false, error: "Too many attempts. Please try again later." };
  return { ok: false, error: "Sign-in is temporarily unavailable. Please try again." };
}

export interface SignUpResult {
  ok: boolean;
  error?: string;
  testOnlyCode?: string;
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<SignUpResult> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (response.ok && payload?.ok) return { ok: true, testOnlyCode: payload.testOnlyCode };
  if (response.status === 429) return { ok: false, error: payload?.error ?? "Too many attempts. Please try again later." };
  if (response.status >= 400 && response.status < 500) return { ok: false, error: payload?.error ?? "Please check your details and try again." };
  if (response.status === 503) {
    return {
      ok: false,
      error: payload?.error ?? "Email verification is not configured yet. Add a VANTAGE sending domain or enable VANTAGE_EMAIL_TEST_MODE for controlled testing.",
    };
  }
  return { ok: false, error: "Sign up is temporarily unavailable. Please try again." };
}

export interface VerifyEmailResult {
  ok: boolean;
  error?: string;
  testOnlyCode?: string;
}

export async function verifyEmail(email: string, code: string): Promise<VerifyEmailResult> {
  const response = await fetch("/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (response.ok) return { ok: true };
  const payload = await response.json().catch(() => null);
  if (response.status === 429) return { ok: false, error: payload?.error ?? "Too many attempts. Please try again later." };
  if (response.status >= 400 && response.status < 500) return { ok: false, error: payload?.error ?? "Invalid or expired code." };
  return { ok: false, error: "Verification is temporarily unavailable. Please try again." };
}

export async function resendVerification(email: string): Promise<VerifyEmailResult> {
  const response = await fetch("/api/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = await response.json().catch(() => null);
  if (response.ok) return { ok: true, testOnlyCode: payload?.testOnlyCode };
  if (response.status === 503) {
    return {
      ok: false,
      error: payload?.error ?? "Email verification is not configured yet. Add a VANTAGE sending domain or enable VANTAGE_EMAIL_TEST_MODE for controlled testing.",
    };
  }
  return { ok: false, error: payload?.error ?? "Could not resend the code right now." };
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
}

export function resolveSafeRedirect(raw: string | null | undefined, fallback: string = DEFAULT_REDIRECT): string {
  if (!raw) return fallback;
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { return fallback; }
  if (decoded.length > 0 && decoded.length <= 512 && decoded.startsWith("/") && !decoded.startsWith("//") && !decoded.startsWith("/\\") && !decoded.includes("\\") && !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(decoded)) return decoded;
  return fallback;
}

export function getCurrentPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export function getUserInitials(user: Pick<CurrentUser, "name" | "email">): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
