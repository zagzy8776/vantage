import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { getPersistedJobsByIds, persistJobs } from "@/providers/jobs/persistence";
import { researchJobs } from "@/services/jobs/source-research";
import { analyzeJob } from "@/services/jobs/analysis";

export const dynamic = "force-dynamic";
const BATCH_SIZE = 3;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request); if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 100) : [];
    const requestedOffset = Number(body?.offset ?? 0); const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.floor(requestedOffset)) : 0;
    if (!ids.length) return NextResponse.json({ error: "Job ids are required." }, { status: 400 });
    if (offset >= ids.length) return NextResponse.json({ jobs: [], processed: 0, nextOffset: ids.length, done: true, aiAnalyzed: 0, evidenceReady: 0 });

    const batchIds = ids.slice(offset, offset + BATCH_SIZE);
    const ownedJobs = await getPersistedJobsByIds(batchIds, auth);
    const researched = await researchJobs(ownedJobs, ownedJobs.length);
    const results: typeof researched = [];
    let aiAnalyzed = 0;
    for (const job of researched) {
      const intelligence = await analyzeJob(job);
      if (intelligence.source === "ai") aiAnalyzed += 1;
      results.push({ ...job, intelligence });
    }
    await persistJobs(results, auth);
    const nextOffset = offset + batchIds.length;
    return NextResponse.json({ jobs: results, processed: batchIds.length, nextOffset, done: nextOffset >= ids.length, aiAnalyzed, evidenceReady: results.length, requested: batchIds.length, found: ownedJobs.length }, { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "jobs_enrichment_failed", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Deep job research is temporarily unavailable. The initial discovery results remain usable." }, { status: 503 });
  }
}
