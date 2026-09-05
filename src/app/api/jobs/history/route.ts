import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { clearJobSearchHistory, listJobSearchHistory, recordJobSearchHistory } from "@/services/jobs/search-history";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.floor(rawLimit), 100)) : 50;
    const history = await listJobSearchHistory(auth, limit);
    return NextResponse.json({ history }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "job_search_history_list_failed", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Job search history is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) return NextResponse.json({ error: "Search query is required." }, { status: 400 });

    const providers = Array.isArray(body?.providers) ? body.providers.filter((value): value is string => typeof value === "string") : [];
    await recordJobSearchHistory({
      query,
      countryCode: typeof body?.countryCode === "string" ? body.countryCode : undefined,
      country: typeof body?.country === "string" ? body.country : undefined,
      city: typeof body?.city === "string" ? body.city : undefined,
      remote: typeof body?.remote === "boolean" ? body.remote : undefined,
      directOnly: typeof body?.directOnly === "boolean" ? body.directOnly : undefined,
      postedWithinDays: Number(body?.postedWithinDays ?? 30),
      providers,
      resultCount: Number(body?.resultCount ?? 0),
    }, auth);

    return NextResponse.json({ recorded: true }, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "job_search_history_record_failed", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Job search history could not be saved." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    await clearJobSearchHistory(auth);
    return NextResponse.json({ cleared: true });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "job_search_history_clear_failed", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Job search history could not be cleared." }, { status: 503 });
  }
}
