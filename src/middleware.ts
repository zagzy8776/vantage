import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

const WORKSPACE_COOKIE = "vantage_workspace";
const WORKSPACE_HEADER = "x-vantage-workspace-id";

export default function middleware(request: NextRequest) {
  if (process.env.VANTAGE_PUBLIC_MODE !== "true") {
    return NextResponse.next();
  }

  const existing = request.cookies.get(WORKSPACE_COOKIE)?.value?.trim();
  const workspaceId = existing || `anon_${crypto.randomUUID()}`;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(WORKSPACE_HEADER, workspaceId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!existing) {
    response.cookies.set(WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }

  return response;
}
