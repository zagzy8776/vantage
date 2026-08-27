import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

const WORKSPACE_COOKIE = "vantage_workspace";
const WORKSPACE_HEADER = "x-vantage-workspace-id";

/**
 * Match auth middleware: public mode is ON unless explicitly disabled.
 * A stable workspace cookie is required so guest scans stay in "Your scans"
 * after leaving the page or refreshing.
 */
function isPublicModeEnabled(): boolean {
  return process.env.VANTAGE_PUBLIC_MODE !== "false";
}

function newWorkspaceId(): string {
  try {
    return `anon_${crypto.randomUUID()}`;
  } catch {
    return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export default function middleware(request: NextRequest) {
  if (!isPublicModeEnabled()) {
    return NextResponse.next();
  }

  const existing = request.cookies.get(WORKSPACE_COOKIE)?.value?.trim();
  const workspaceId =
    existing && existing.length > 0 && existing !== "anon_unscoped"
      ? existing
      : newWorkspaceId();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(WORKSPACE_HEADER, workspaceId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Always (re)assert the cookie so guests keep the same workspace across visits.
  // Replace legacy shared "anon_unscoped" with a private durable id.
  if (!existing || existing === "anon_unscoped") {
    response.cookies.set(WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180, // 180 days
    });
  }

  return response;
}
