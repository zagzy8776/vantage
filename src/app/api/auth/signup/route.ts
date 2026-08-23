/**
 * POST /api/auth/signup
 *
 * Self-service account creation. Creates an UNVERIFIED account and emails a
 * 6-digit verification code. No session is issued here - the account cannot
 * be used until POST /api/auth/verify-email succeeds.
 *
 * Responses are deliberately uniform for existing verified emails to prevent
 * user enumeration.
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
} from "@/auth/verification-store";
import { sendVerificationEmail } from "@/lib/email/resend";
import { checkEndpointRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

interface IssueOutcome {
  sent: boolean;
  configured: boolean;
  reason?: string;
  /** Set only when no email provider is configured AND not production. */
  devOnlyCode?: string;
}

/** Issue a code; persist only its hash; email the plaintext. */
async function issueAndSendCode(userId: string, email: string): Promise<IssueOutcome> {
  const code = generateVerificationCode();
  await insertVerification({
    userId,
    codeHash: hashCodeVerification(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const result = await sendVerificationEmail(email, code);
  if (result.sent) {
    return { sent: true, configured: true };
  }

  if (!result.configured && process.env.NODE_ENV !== "production") {
    // Local/dev convenience: no provider configured. The plaintext code is
    // returned ONLY here - never in production, never persisted or logged.
    return { sent: false, configured: false, devOnlyCode: code };
  }

  return {
    sent: false,
    configured: result.configured,
    reason: result.reason ?? "Could not send verification email.",
  };
}

function uniformOk(): NextResponse {
  // Identical for all outcomes that reach this point - prevents enumeration.
  return NextResponse.json({ ok: true, message: "Check your email to continue." });
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

    const existing = await findUserByEmail(email);

    if (existing?.emailVerified) {
      // Uniform response - do not reveal that the account exists, do not send.
      return uniformOk();
    }

    let userId: string;
    if (existing && !existing.emailVerified) {
      // Unverified duplicate: continue verifying the same account.
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

    // A still-valid pending code means one was already issued recently.
    const pending = await findLatestPendingVerification(userId);
    if (pending) {
      return uniformOk();
    }

    const outcome = await issueAndSendCode(userId, email);

    if (!outcome.sent) {
      if (!outcome.configured) {
        return NextResponse.json({
          ok: true,
          message: "Check your email to continue.",
          devOnlyCode: outcome.devOnlyCode,
        });
      }
      return NextResponse.json(
        { error: outcome.reason ?? "Could not send verification email." },
        { status: 503 }
      );
    }

    return uniformOk();
  } catch (error) {
    console.error("Signup error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}
