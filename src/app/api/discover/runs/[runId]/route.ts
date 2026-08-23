import { NextRequest, NextResponse } from "next/server";
import { getSearchRun } from "@/services/search-runs/service";
import { unstable_noStore } from "next/cache";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: { runId: string } }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    unstable_noStore();
    const run = await getSearchRun(context.params.runId);
    if (!run) return NextResponse.json({ error: "Search run not found." }, { status: 404 });
    return NextResponse.json({
      runId: run.id,
      status: run.status,
      query: { category: run.query, country: run.country, city: run.city, depth: run.depth },
      startedAt: run.startedAt ?? run.createdAt,
      completedAt: run.completedAt,
      durationMs: run.durationMs,
      stages: run.stages ?? {},
      failures: run.failures ?? [],
       providerMetrics: run.providerMetrics ?? {},
      result: run.result ?? null,
      requestedProvider: (run.result as { requestedProvider?: string } | null)?.requestedProvider ?? (run.providerMetrics as { requestedProvider?: string } | null)?.requestedProvider ?? run.searchSource ?? "best-available",
      queriedProviders: (run.result as { queriedProviders?: string[] } | null)?.queriedProviders ?? run.providers ?? [],
      fallbackUsed: Boolean((run.result as { fallbackUsed?: boolean } | null)?.fallbackUsed),
      summary: {
        discovered: run.discoveredCount,
        webCandidates: run.candidatesReturned,
        verified: run.verifiedCount,
        enriched: run.enrichedCount,
        analyzed: typeof (run.result?.workflow as { aiAnalyzedCount?: unknown } | undefined)?.aiAnalyzedCount === "number" ? (run.result?.workflow as { aiAnalyzedCount: number }).aiAnalyzedCount : 0,
      },
    }, { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    return NextResponse.json({ error: "Search run state is unavailable." }, { status: 503 });
  }
}