/**
 * POST /api/auth/signup
 *
 * Self-service account creation. Normally creates an UNVERIFIED account and
 * emails a 6-digit verification code. While VANTAGE is running in the
 * explicit pre-domain temporary auth mode, the account is activated and a
 * session is issued immediately so product testing does not depend on email.
 */

import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, createUser } from "@/auth/user-store";
import { hashPassword } from "@/auth/password";
import { validateSignupInput } from "@/auth/signup-validation";
import {
  CODE_TTL_MS,
  generateVerificationCode,
  hashCodeVerification,
} from "@/auth/verification";
import {
  findLatestPendingVerification,
  insertVerification,
  activateUserWithWorkspace,
} from "@/auth/verification-store";
import { createAuthenticatedSession, sessionResponse } from "@/auth/session-issue";
import { sendVerificationEmail } from "@/lib/email/resend";
import { isTemporaryAuthModeEnabled } from "@/auth/auth-mode";
import { checkEndpointRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

interface IssueOutcome {
  sent: boolean;
  configured: boolean;
  reason?: string;
  testOnlyCode?: string;
}

function isEmailTestModeEnabled(): boolean {
  return process.env.VANTAGE_EMAIL_TEST_MODE === "true";
}

async function issueAndSendCode(userId: string, email: string): Promise<IssueOutcome> {
  const code = generateVerificationCode();
  await insertVerification({
    userId,
    codeHash: hashCodeVerification(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  if (isEmailTestModeEnabled()) {
    return { sent: false, configured: false, testOnlyCode: code };
  }

  const result = await sendVerificationEmail(email, code);
  if (result.sent) return { sent: true, configured: true };
  return {
    sent: false,
    configured: result.configured,
    reason: result.reason ?? "Could not send verification email.",
  };
}

function uniformOk(): NextResponse {
  return NextResponse.json({ ok: true, message: "Your account already exists. Please sign in." });
}

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
    const errors = validateSignupInput(body ?? {});
    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    const email = String(body.email).trim().toLowerCase();
    const name = String(body.name).trim();
    const password = String(body.password);
    const temporaryAuthMode = isTemporaryAuthModeEnabled();

    const existing = await findUserByEmail(email);

    if (existing?.emailVerified) return uniformOk();

    let userId: string;
    if (existing && !existing.emailVerified) {
      userId = existing.id;
    } else {
      const created = await createUser({
        email,
        name,
        passwordHash: await hashPassword(password),
        role: "analyst",
        organizationId: null,
        emailVerified: false,
      });
      userId = created.id;
    }

    if (temporaryAuthMode) {
      const activated = await activateUserWithWorkspace({ userId, name });
      const user = await findUserByEmail(email);
      if (!user) return NextResponse.json({ error: "Sign up failed" }, { status: 500 });

      const { token, expiresAt } = await createAuthenticatedSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: activated.role,
        organizationId: activated.organizationId,
      });

      return sessionResponse(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: activated.role,
          organizationId: activated.organizationId,
        },
        { authenticated: true, temporaryAuth: true },
        token,
        expiresAt
      );
    }

    const pending = await findLatestPendingVerification(userId);
    if (pending && !isEmailTestModeEnabled()) return uniformOk();

    const outcome = await issueAndSendCode(userId, email);

    if (outcome.testOnlyCode) {
      return NextResponse.json({
        ok: true,
        message: "Test verification code generated.",
        testOnlyCode: outcome.testOnlyCode,
      });
    }

    if (!outcome.sent) {
      return NextResponse.json(
        {
          error:
            outcome.reason ??
            "Could not send the verification email. Configure a VANTAGE sending domain before enabling customer email verification.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, message: "Check your email to continue." });
  } catch (error) {
    console.error("Signup error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}
