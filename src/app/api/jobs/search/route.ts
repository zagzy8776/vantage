import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { runJobDiscovery } from "@/providers/jobs/router";
import { listPersistedJobs, persistJobs } from "@/providers/jobs/persistence";
import { analyzeJobs } from "@/services/jobs/analysis";
import type { JobProvider } from "@/providers/jobs/types";

export const dynamic = "force-dynamic";

const providerNames = new Set<JobProvider>(["adzuna", "jsearch", "jobspipe", "hirebase", "theirstack"]);

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Job title or search terms are required." }, { status: 400 });
    const limitRaw = Number(body?.limit ?? 25);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 25, 100));
    const providers = Array.isArray(body?.providers) ? body.providers.filter((value): value is JobProvider => typeof value === "string" && providerNames.has(value as JobProvider)) : undefined;
    const remote = typeof body?.remote === "boolean" ? body.remote : undefined;
    const countryCode = typeof body?.countryCode === "string" ? body.countryCode.trim().toUpperCase() : undefined;
    const country = typeof body?.country === "string" ? body.country.trim() : undefined;
    const city = typeof body?.city === "string" ? body.city.trim() : undefined;
    const postedWithinDaysRaw = Number(body?.postedWithinDays ?? 30);
    const postedWithinDays = Number.isFinite(postedWithinDaysRaw) ? Math.max(1, Math.min(Math.floor(postedWithinDaysRaw), 90)) : 30;

    const discovery = await runJobDiscovery({ title, country, countryCode, city, remote, limit, postedWithinDays }, providers);
    const intelligence = await analyzeJobs(discovery.jobs, Math.min(12, limit));
    const result = { ...discovery, jobs: intelligence.jobs };

    let persistedCount = 0;
    let persistenceFailed = false;
    try {
      persistedCount = await persistJobs(result.jobs, auth);
    } catch (error) {
      persistenceFailed = true;
      console.error(JSON.stringify({ diagnostic: "jobs_persistence_failed", message: error instanceof Error ? error.message : String(error) }));
    }

    const directEmployerVerifiedCount = result.jobs.filter((job) => job.verificationStatus === "direct_employer_verified").length;
    const needsVerificationCount = result.jobs.filter((job) => job.verificationStatus === "needs_verification").length;
    const providerFailures = result.providers.filter((provider) => provider.status === "failed" || provider.status === "rate-limited").length;

    return NextResponse.json({
      ...result,
      persistedCount,
      persistence: { persisted: !persistenceFailed && persistedCount === result.jobs.length, failed: persistenceFailed },
      verification: { checked: result.verification.attempted, directEmployerVerified: directEmployerVerifiedCount, needsVerification: needsVerificationCount, remainingUnverified: result.jobs.length - directEmployerVerifiedCount - needsVerificationCount },
      intelligence: { attempted: intelligence.attempted, analyzed: intelligence.analyzed },
      diagnostics: { providersFailed: providerFailures, providersConfigured: result.configuredProviders.length, jobsDiscovered: result.jobs.length },
      policy: { directEmployerVerification: "public-source-evidence-required", fabricatedData: false, jobRequirements: "source-grounded-ai-analysis" },
    }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "jobs_search_failed", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Job discovery is temporarily unavailable." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? 50);
    const jobs = await listPersistedJobs(auth, Number.isFinite(limitRaw) ? limitRaw : 50);
    return NextResponse.json({ jobs }, { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "jobs_list_failed", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Saved job intelligence is temporarily unavailable." }, { status: 503 });
  }
}
