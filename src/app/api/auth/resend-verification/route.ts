/**
 * POST /api/auth/resend-verification
 *
 * Issues a fresh verification code for an unverified account.
 * - Enforces a cooldown between sends (per account).
 * - Responses are uniform for unknown/verified accounts (no enumeration).
 */

import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/auth/user-store";
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  generateVerificationCode,
  hashCodeVerification,
  isResendAllowed,
} from "@/auth/verification";
import {
  findLatestPendingVerification,
  insertVerification,
} from "@/auth/verification-store";
import { sendVerificationEmail } from "@/lib/email/resend";
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
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const uniformOk = NextResponse.json({
      ok: true,
      message: "If a verification code can be sent, it is on its way.",
    });

    const user = await findUserByEmail(email);
    if (!user || user.emailVerified) {
      // Uniform response - never reveal account existence or status.
      return uniformOk;
    }

    const pending = await findLatestPendingVerification(user.id);
    if (pending && !isResendAllowed(pending.createdAt)) {
      const retryIn = Math.max(
        1,
        Math.ceil(
          (pending.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000
        )
      );
      return NextResponse.json(
        { error: `Please wait ${retryIn}s before requesting a new code.` },
        { status: 429 }
      );
    }

    const code = generateVerificationCode();
    await insertVerification({
      userId: user.id,
      codeHash: hashCodeVerification(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });

    const result = await sendVerificationEmail(user.email, code);
    if (!result.sent && result.configured) {
      return NextResponse.json(
        { error: result.reason ?? "Could not send the email right now." },
        { status: 503 }
      );
    }

    return uniformOk;
  } catch (error) {
    console.error("Resend-verification error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Could not resend code" }, { status: 500 });
  }
}
