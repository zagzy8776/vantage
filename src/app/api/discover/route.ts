import { NextRequest, NextResponse } from "next/server";
import { validateDiscoveryQuery } from "@/lib/discover/validation";
import { createSearchRun } from "@/services/search-runs/service";
import { requireRole } from "@/auth/middleware";

export const dynamic = "force-dynamic";

/**
 * POST /api/discover
 *
 * Creates a Search Run as durable state (status "queued") and returns
 * immediately. The scheduled sweep worker (/api/system/sweep via Vercel Cron,
 * or the in-process sweeper on long-lived runtimes) dispatches queued runs
 * through the discovery engine. No fire-and-forget promise is used: a
 * serverless response must never be relied upon to keep work alive.
 */
export async function POST(request: NextRequest) {
  // Discovery triggers paid provider calls - analyst access or higher required
  const auth = await requireRole(request, ["owner", "admin", "analyst"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null);
    const validation = validateDiscoveryQuery(body ?? {});

    if (!validation.ok || !validation.query) {
      return NextResponse.json({ error: validation.errors[0] ?? "Invalid discovery query." }, { status: 400 });
    }

    const runId = await createSearchRun(validation.query);
    return NextResponse.json({ runId, status: "queued" }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "Discovery database is unavailable." }, { status: 503 });
    }

    return NextResponse.json({ error: "Unexpected discovery error. Please try again." }, { status: 500 });
  }
}
