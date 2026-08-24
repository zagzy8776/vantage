import { NextRequest, NextResponse } from "next/server";
import { getSearchRun } from "@/services/search-runs/service";
import { canAccessSearchRun } from "@/services/search-runs/access";
import { unstable_noStore } from "next/cache";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

function customerResult(result: Record<string, unknown> | null) {
  if (!result) return null;
  return {
    results: Array.isArray(result.results) ? result.results : [],
    storedIds: Array.isArray(result.storedIds) ? result.storedIds : [],
    totalUniqueResults: typeof result.totalUniqueResults === "number" ? result.totalUniqueResults : undefined,
    workflow: result.workflow && typeof result.workflow === "object"
      ? { stage: (result.workflow as { stage?: unknown }).stage }
      : undefined,
  };
}

export async function GET(request: NextRequest, context: { params: { runId: string } }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    unstable_noStore();
    const run = await getSearchRun(context.params.runId);
    if (!run) return NextResponse.json({ error: "Search run not found." }, { status: 404 });

    if (!(await canAccessSearchRun(run.id, auth))) {
      // Avoid revealing whether another tenant's run exists.
      return NextResponse.json({ error: "Search run not found." }, { status: 404 });
    }

    // Customer-facing state contains outcomes and progress only. Provider
    // names, diagnostics, fallback information, source internals and cost data
    // remain server/admin concerns.
    return NextResponse.json({
      runId: run.id,
      status: run.status,
      query: { category: run.query, country: run.country, city: run.city, depth: run.depth },
      startedAt: run.startedAt ?? run.createdAt,
      completedAt: run.completedAt,
      durationMs: run.durationMs,
      stages: run.stages ?? {},
      result: customerResult(run.result),
      summary: {
        discovered: run.discoveredCount,
        webCandidates: run.candidatesReturned,
        verified: run.verifiedCount,
        enriched: run.enrichedCount,
        analyzed: typeof (run.result?.workflow as { aiAnalyzedCount?: unknown } | undefined)?.aiAnalyzedCount === "number"
          ? (run.result?.workflow as { aiAnalyzedCount: number }).aiAnalyzedCount
          : 0,
        hasIssues: run.status === "completed_with_errors" || (Array.isArray(run.failures) && run.failures.length > 0),
      },
    }, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch {
    return NextResponse.json({ error: "Search run state is unavailable." }, { status: 503 });
  }
}