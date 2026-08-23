import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  recordSession,
  touchLastLogin,
  ensureOwnerUser,
} from "@/auth/user-store";
import { verifyPassword } from "@/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/auth/tokens";
import { checkEndpointRateLimit } from "@/lib/security/rate-limiter";

/** Default session lifetime: 24 hours (matches tokens.ts) */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function buildSessionCookie(token: string): string {
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

/**
 * POST /api/auth/login
 *
 * Validates credentials against the users table and issues an HMAC-signed,
 * revocable session token stored in an HttpOnly cookie.
 * Responses are deliberately generic to prevent user enumeration.
 */
export async function POST(request: NextRequest) {
  try {
    await ensureOwnerUser();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = checkEndpointRateLimit(ip, "expensive");
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);

    if (!user || !user.passwordHash) {
      await verifyPassword(password, "scrypt$16384$8$1$00$00");
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Unverified self-service accounts must not receive a workspace session.
    if (!user.emailVerified) {
      return NextResponse.json(
        {
          error: "Please verify your email address before signing in.",
          code: "EMAIL_NOT_VERIFIED",
          email: user.email,
        },
        { status: 403 }
      );
    }

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
      organizationId: user.organizationId,
      expiresAt,
    });

    void touchLastLogin(user.id).catch(() => undefined);

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      expiresAt: expiresAt.toISOString(),
    });
    response.headers.set("Set-Cookie", buildSessionCookie(token));
    return response;
  } catch (error) {
    console.error("Login error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
