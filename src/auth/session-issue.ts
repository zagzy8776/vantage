/**
 * Shared session issuance for login and email-verification flows.
 *
 * Extracted from POST /api/auth/login so every entry point that creates an
 * authenticated VANTAGE session uses identical mechanics: HMAC-signed token
 * (./tokens), server-side revocation record (./user-store), HttpOnly cookie.
 */

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME } from "./tokens";
import { recordSession } from "./user-store";
import type { UserRole } from "./types";

/** Default session lifetime: 24 hours (matches tokens.ts) */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function buildSessionCookie(token: string): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }
  attributes.push(`Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  return attributes.join("; ");
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string | null;
}

/**
 * Create a full authenticated session for a user:
 * signed token + server-side session record + Set-Cookie header value.
 */
export async function createAuthenticatedSession(user: SessionUser): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const sessionId = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const token = createSessionToken(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    },
    SESSION_TTL_MS,
    new Date(),
    sessionId
  );

  await recordSession({
    id: sessionId,
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId ?? null,
    expiresAt,
  });

  return { token, expiresAt };
}

/** Convenience: build a JSON response with the session cookie attached. */
export function sessionResponse(
  user: SessionUser,
  payload: Record<string, unknown>,
  token: string,
  expiresAt: Date
): NextResponse {
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    },
    expiresAt: expiresAt.toISOString(),
    ...payload,
  });
  response.headers.set("Set-Cookie", buildSessionCookie(token));
  return response;
}
