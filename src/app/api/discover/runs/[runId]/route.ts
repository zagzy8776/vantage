import { NextRequest, NextResponse } from "next/server";
import { getSearchRun } from "@/services/search-runs/service";
import { canAccessSearchRun } from "@/services/search-runs/access";
import { unstable_noStore } from "next/cache";
import { requireAuth } from "@/auth/middleware";

export const dynamic = "force-dynamic";

type RawBusiness = Record<string, unknown>;

function customerResult(result: Record<string, unknown> | null) {
  if (!result) return null;

  const rawResults = Array.isArray(result.results) ? result.results : [];
  const storedIds = Array.isArray(result.storedIds) ? result.storedIds : [];
  const resultSources = Array.isArray(result.resultSources) ? result.resultSources : [];

  const results = rawResults.map((item, index) => {
    if (!item || typeof item !== "object") {
      return {
        leadId: typeof storedIds[index] === "string" ? storedIds[index] : undefined,
        externalId: `result_${index + 1}`,
        source: "web",
        name: `Research result ${index + 1}`,
      };
    }

    const business = item as RawBusiness;
    const source = typeof business.source === "string" ? business.source : undefined;
    const sources = Array.isArray(resultSources[index])
      ? (resultSources[index] as unknown[]).filter((value): value is string => typeof value === "string")
      : [];

    return {
      leadId: typeof storedIds[index] === "string" ? storedIds[index] : undefined,
      externalId: typeof business.externalId === "string" ? business.externalId : `result_${index + 1}`,
      source: source ?? sources[0] ?? "web",
      sources,
      name: typeof business.name === "string" ? business.name : `Research result ${index + 1}`,
      category: typeof business.category === "string" ? business.category : undefined,
      country: typeof business.country === "string" ? business.country : undefined,
      region: typeof business.region === "string" ? business.region : undefined,
      city: typeof business.city === "string" ? business.city : undefined,
      area: typeof business.area === "string" ? business.area : undefined,
      street: typeof business.street === "string" ? business.street : undefined,
      website: typeof business.website === "string" ? business.website : undefined,
      phone: typeof business.phone === "string" ? business.phone : undefined,
      rating: typeof business.rating === "number" ? business.rating : undefined,
      reviewCount: typeof business.reviewCount === "number" ? business.reviewCount : undefined,
      verificationStatus: typeof business.verificationStatus === "string" ? business.verificationStatus : undefined,
      dataFreshness: typeof business.dataFreshness === "string" ? business.dataFreshness : undefined,
      observedAt: typeof business.observedAt === "string" ? business.observedAt : undefined,
    };
  });

  return {
    results,
    storedIds: storedIds.filter((value): value is string => typeof value === "string"),
    totalUniqueResults: typeof result.totalUniqueResults === "number" ? result.totalUniqueResults : undefined,
    workflow:
      result.workflow && typeof result.workflow === "object"
        ? {
            stage: (result.workflow as { stage?: unknown }).stage,
            cacheHit: (result.workflow as { cacheHit?: unknown }).cacheHit,
            cacheSourceRunId: (result.workflow as { cacheSourceRunId?: unknown }).cacheSourceRunId,
            aiAnalyzedCount: (result.workflow as { aiAnalyzedCount?: unknown }).aiAnalyzedCount,
          }
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
      return NextResponse.json({ error: "Search run not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        runId: run.id,
        query: run.query,
        country: run.country,
        city: run.city,
        depth: run.depth,
        status: run.status,
        discoveredCount: run.discoveredCount,
        enrichedCount: run.enrichedCount,
        verifiedCount: run.verifiedCount,
        createdAt: run.createdAt,
        startedAt: run.startedAt ?? run.createdAt,
        completedAt: run.completedAt,
        durationMs: run.durationMs,
        stages: Object.fromEntries(
          Object.entries((run.stages ?? {}) as Record<string, { status?: string }>).map(([stage, value]) => [
            stage,
            { status: value?.status },
          ]),
        ),
        result: customerResult(run.result),
        summary: {
          discovered: run.discoveredCount,
          webCandidates: run.candidatesReturned,
          verified: run.verifiedCount,
          enriched: run.enrichedCount,
          analyzed:
            typeof (run.result?.workflow as { aiAnalyzedCount?: unknown } | undefined)?.aiAnalyzedCount === "number"
              ? (run.result?.workflow as { aiAnalyzedCount: number }).aiAnalyzedCount
              : 0,
          hasIssues: run.status === "completed_with_errors" || (Array.isArray(run.failures) && run.failures.length > 0),
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      },
    );
  } catch {
    return NextResponse.json({ error: "Search run state is unavailable." }, { status: 503 });
  }
}
