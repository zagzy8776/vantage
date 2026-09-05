import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { getPersistedJobsByIds, persistJobs } from "@/providers/jobs/persistence";
import { researchJobs } from "@/services/jobs/source-research";
import { deepResolveJobs } from "@/services/jobs/deep-resolver";
import { resolveApplicationAndContactsBatch } from "@/services/jobs/application-resolver";
import { analyzeJob } from "@/services/jobs/analysis";

export const dynamic = "force-dynamic";
const BATCH_SIZE = 3;
const DEEP_RESOLUTION_CONCURRENCY = 2;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request); if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 100) : [];
    const requestedOffset = Number(body?.offset ?? 0); const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.floor(requestedOffset)) : 0;
    if (!ids.length) return NextResponse.json({ error: "Job ids are required." }, { status: 400 });
    if (offset >= ids.length) return NextResponse.json({ jobs: [], processed: 0, nextOffset: ids.length, done: true, aiAnalyzed: 0, evidenceReady: 0, applicationPaths: 0, employerSources: 0, publicContacts: 0, researchMessage: "Vantage completed the public-source research queue." });
    const batchIds = ids.slice(offset, offset + BATCH_SIZE);
    const ownedJobs = await getPersistedJobsByIds(batchIds, auth);
    const researched = await researchJobs(ownedJobs, ownedJobs.length);
    const resolved = await deepResolveJobs(researched, DEEP_RESOLUTION_CONCURRENCY);
    const finalResolved = await resolveApplicationAndContactsBatch(resolved, DEEP_RESOLUTION_CONCURRENCY);
    const results: typeof finalResolved = [];
    let aiAnalyzed = 0;
    const queue = [...finalResolved]; const concurrency = Math.min(2, queue.length);
    async function worker() { while (queue.length) { const job = queue.shift(); if (!job) return; const intelligence = await analyzeJob(job); if (intelligence.source === "ai") aiAnalyzed += 1; results.push({ ...job, intelligence }); } }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    await persistJobs(results, auth);
    const nextOffset = offset + batchIds.length;
    const applicationPaths = results.filter((job) => Boolean(job.applyUrl)).length;
    const employerSources = results.filter((job) => Boolean(job.companyWebsite)).length;
    const publicContacts = results.filter((job) => Boolean(job.companyPhone || job.companyEmail)).length;
    const evidenceReady = results.filter((job) => Boolean(job.companyWebsite || job.applyUrl || job.companyPhone || job.companyEmail || job.verificationEvidence?.length)).length;
    const unresolvedApplicationPaths = results.length - applicationPaths;
    const unresolvedContacts = results.length - publicContacts;
    const researchMessage = unresolvedApplicationPaths === 0 && unresolvedContacts === 0
      ? "Vantage found a public employer source, an application path, and public contact information for every researched listing in this batch."
      : `Vantage searched public employer, careers, ATS, and contact sources for this batch. ${applicationPaths}/${results.length} have verified application paths and ${publicContacts}/${results.length} have public employer contact information. Any missing field was not exposed with enough evidence to safely publish it.`;
    return NextResponse.json({ jobs: results, processed: batchIds.length, nextOffset, done: nextOffset >= ids.length, aiAnalyzed, evidenceReady, applicationPaths, employerSources, publicContacts, requested: batchIds.length, found: ownedJobs.length, researchMessage }, { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "jobs_enrichment_failed", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Deep job research is temporarily unavailable. The initial discovery results remain usable." }, { status: 503 });
  }
}