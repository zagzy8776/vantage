/**
 * Production Hardening Phase 1: Authentication & Authorization
 *
 * Stateless session tokens: HMAC-SHA256 signed payloads.
 *
 * Token format: v1.<base64url(payload)>.<base64url(signature)>
 * Fail-closed: verification returns null when the secret is missing,
 * the token is malformed, the signature does not match, or it has expired.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Session } from "./types";
import { getSecret } from "@/lib/security/secrets";

const TOKEN_VERSION = "v1";
export const SESSION_COOKIE_NAME = "session";

/** Default session lifetime: 24 hours */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface TokenPayload {
  sub: string;
  email: string;
  role: Session["role"];
  org?: string;
  jti: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * Constant-time signature comparison
 */
function signaturesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Create a signed session token for a user session
 *
 * Throws when AUTH_SECRET is not configured - callers should treat
 * an unusable auth configuration as an operational error, never fall
 * back to unsigned tokens.
 */
export function createSessionToken(
  session: Pick<Session, "userId" | "email" | "role" | "organizationId">,
  ttlMs: number = DEFAULT_TTL_MS,
  now: Date = new Date(),
  jti: string = randomBytes(16).toString("hex")
): string {
  const secret = getSecret("AUTH_SECRET");
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  const payload: TokenPayload = {
    sub: session.userId,
    email: session.email,
    role: session.role,
    org: session.organizationId,
    jti,
    iat: now.getTime(),
    exp: now.getTime() + ttlMs,
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${TOKEN_VERSION}.${payloadB64}`;

  return `${data}.${sign(data, secret)}`;
}

/**
 * Verify a session token and return the session, or null if invalid
 */
export function verifySessionToken(
  token: string | null | undefined,
  now: Date = new Date()
): Session | null {
  if (!token) {
    return null;
  }

  const secret = getSecret("AUTH_SECRET");
  if (!secret) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
    return null;
  }

  const [, payloadB64, signature] = parts;
  const expected = sign(`${TOKEN_VERSION}.${payloadB64}`, secret);
  if (!signaturesMatch(signature, expected)) {
    return null;
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64)) as TokenPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.role !== "string" ||
    typeof payload.jti !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }

  if (payload.exp <= now.getTime()) {
    return null;
  }

  return {
    sessionId: payload.jti,
    userId: payload.sub,
    email: payload.email,
    role: payload.role as Session["role"],
    organizationId: payload.org,
    createdAt: new Date(payload.iat),
    expiresAt: new Date(payload.exp),
  };
}
