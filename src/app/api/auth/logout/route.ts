import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/auth/tokens";
import { revokeSession } from "@/auth/user-store";

/**
 * POST /api/auth/logout
 *
 * Revokes the session server-side so the signed token cannot be replayed
 * after logout, even if the cookie was copied. Cookie is always cleared.
 */
export async function POST(request: NextRequest) {
  try {
    const token =
      request.cookies.get(SESSION_COOKIE_NAME)?.value ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    const session = verifySessionToken(token);
    if (session?.sessionId) {
      await revokeSession(session.sessionId);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("Logout error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
