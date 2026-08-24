
/**
 * Shared session issuance for login and email-verification flows.
 *
 * Every entry point that creates an authenticated VANTAGE session uses the
 * same HMAC-signed token, server-side revocation record, and HttpOnly cookie.
 */

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME } from "./tokens";
import { recordSession } from "./user-store";
import type { UserRole } from "./types";

/** Default session lifetime: 24 hours */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string | null;
}

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

/**
 * Attach the authenticated session through NextResponse.cookies.set rather
 * than a raw Set-Cookie header. This allows the session cookie to coexist
 * safely with the anonymous workspace cookie created by middleware.
 */
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
      anonymous: false,
    },
    expiresAt: expiresAt.toISOString(),
    ...payload,
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return response;
}
