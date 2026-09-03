import { NextRequest, NextResponse } from "next/server";
import { refreshTrackedBusinesses } from "@/lib/opportunity/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.SWEEP_SECRET?.trim();
  if (!secret) return false;
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const startedAt = Date.now();
    const result = await refreshTrackedBusinesses({ limit: Math.max(1, Math.min(Number(process.env.OPPORTUNITY_SWEEP_LIMIT) || 25, 100)) });
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, ...result });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "opportunity_sweep_failed", error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Opportunity refresh failed." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) { return run(request); }
export async function POST(request: NextRequest) { return run(request); }
