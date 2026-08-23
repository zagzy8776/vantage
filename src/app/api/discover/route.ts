import { NextRequest, NextResponse } from "next/server";
import { discoverBusinesses, failDiscoveryRun } from "@/lib/discover/service";
import { validateDiscoveryQuery } from "@/lib/discover/validation";
import { createSearchRun } from "@/services/search-runs/service";
import { requireRole } from "@/auth/middleware";

export const dynamic = "force-dynamic";

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
    void Promise.resolve(discoverBusinesses(validation.query, runId)).catch((error) => failDiscoveryRun(runId, error));
    return NextResponse.json({ runId, status: "created", summary: { discovered: 0, webCandidates: 0, verified: 0, enriched: 0, analyzed: 0 } }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("FOURSQUARE_API_KEY")) {
      return NextResponse.json({ error: "Discovery provider is not configured yet." }, { status: 503 });
    }

    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "Discovery database is unavailable." }, { status: 503 });
    }

    const status = (error as { status?: number } | undefined)?.status;
    if (status === 429) {
      return NextResponse.json({ error: "Discovery provider is temporarily rate-limited. Please try again later." }, { status: 429 });
    }

    return NextResponse.json({ error: "Unexpected discovery error. Please try again." }, { status: 500 });
  }
}