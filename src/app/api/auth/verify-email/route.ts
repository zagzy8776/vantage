/**
 * POST /api/auth/verify-email
 *
 * Verifies a 6-digit email code. On success:
 *   - marks the verification record verified
 *   - activates the account (email_verified = true)
 *   - creates the user's workspace (organization) if they have none
 *   - promotes the user to Owner of that workspace
 *   - issues a full authenticated VANTAGE session (HttpOnly cookie)
 */

import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, touchLastLogin } from "@/auth/user-store";
import {
  evaluateVerification,
  MAX_ATTEMPTS,
} from "@/auth/verification";
import {
  findLatestPendingVerification,
  incrementVerificationAttempts,
  markVerificationVerified,
  activateUserWithWorkspace,
} from "@/auth/verification-store";
import {
  createAuthenticatedSession,
  sessionResponse,
} from "@/auth/session-issue";
import { checkEndpointRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = checkEndpointRateLimit(ip, "expensive");
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body?.code === "string" ? body.code : "";

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    // Generic rejection - do not reveal whether the account exists.
    if (!user) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId ?? null,
    };

    // Already verified: idempotent success - issue the session directly.
    if (user.emailVerified) {
      const { token, expiresAt } = await createAuthenticatedSession(sessionUser);
      return sessionResponse({ ...sessionUser, organizationId: user.organizationId }, {}, token, expiresAt);
    }

    const pending = await findLatestPendingVerification(user.id);
    if (!pending) {
      return NextResponse.json(
        { error: "No pending verification. Request a new code.", code: "NO_PENDING" },
        { status: 400 }
      );
    }

    const outcome = evaluateVerification(pending, code);

    if (outcome === "invalid") {
      await incrementVerificationAttempts(pending.id);
      const remaining = Math.max(0, MAX_ATTEMPTS - (pending.attempts + 1));
      return NextResponse.json(
        {
          error:
            remaining > 0
              ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
              : "Too many incorrect attempts. Request a new code.",
          code: "INVALID",
        },
        { status: 400 }
      );
    }

    if (outcome === "expired") {
      return NextResponse.json(
        { error: "This code has expired. Request a new one.", code: "EXPIRED" },
        { status: 400 }
      );
    }

    if (outcome === "too_many_attempts") {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Request a new code.", code: "TOO_MANY_ATTEMPTS" },
        { status: 400 }
      );
    }

    // Success path.
    await markVerificationVerified(pending.id);
    const { organizationId, role } = await activateUserWithWorkspace({
      userId: user.id,
      name: user.name,
    });

    const { token, expiresAt } = await createAuthenticatedSession({
      ...sessionUser,
      role,
      organizationId,
    });
    void touchLastLogin(user.id).catch(() => undefined);
    return sessionResponse({ ...sessionUser, role, organizationId }, {}, token, expiresAt);
  } catch (error) {
    console.error("Verify-email error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
