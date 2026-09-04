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
    const limitRaw = Number(body?.limit ?? 50);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50, 100));
    const pageRaw = Number(body?.page ?? 1);
    const page = Math.max(1, Math.min(Number.isFinite(pageRaw) ? Math.floor(pageRaw) : 1, 100));
    const providers = Array.isArray(body?.providers) ? body.providers.filter((value): value is JobProvider => typeof value === "string" && providerNames.has(value as JobProvider)) : undefined;
    const remote = typeof body?.remote === "boolean" ? body.remote : undefined;
    const countryCode = typeof body?.countryCode === "string" ? body.countryCode.trim().toUpperCase() : undefined;
    const country = typeof body?.country === "string" ? body.country.trim() : undefined;
    const city = typeof body?.city === "string" ? body.city.trim() : undefined;
    const postedWithinDaysRaw = Number(body?.postedWithinDays ?? 30);
    const postedWithinDays = Number.isFinite(postedWithinDaysRaw) ? Math.max(1, Math.min(Math.floor(postedWithinDaysRaw), 90)) : 30;
    const cursors = body?.cursors && typeof body.cursors === "object" ? body.cursors as Record<string, unknown> : {};
    const cursor = typeof cursors.jsearch === "string" ? cursors.jsearch : undefined;

    const discovery = await runJobDiscovery({ title, country, countryCode, city, remote, limit, postedWithinDays, page, cursor }, providers);
    const intelligence = await analyzeJobs(discovery.jobs, page === 1 ? Math.min(12, discovery.jobs.length) : 0);
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
    const rawProviderHits = result.providers.reduce((sum, provider) => sum + provider.count, 0);
    const totalDiscovered = result.providers.reduce((sum, provider) => sum + (provider.totalCount ?? provider.count), 0);
    const applicationPaths = result.jobs.filter((job) => Boolean(job.applyUrl)).length;
    const employerSources = result.jobs.filter((job) => Boolean(job.companyWebsite)).length;
    const providerHasMore = Object.values(result.pagination).some((value) => Boolean(value.hasMore));

    return NextResponse.json({
      ...result,
      persistedCount,
      persistence: { persisted: !persistenceFailed && persistedCount === result.jobs.length, failed: persistenceFailed },
      verification: { checked: result.verification.attempted, directEmployerVerified: directEmployerVerifiedCount, needsVerification: needsVerificationCount, remainingUnverified: result.jobs.length - directEmployerVerifiedCount - needsVerificationCount },
      intelligence: { attempted: intelligence.attempted, analyzed: intelligence.analyzed },
      pagination: { page, hasMore: providerHasMore, providers: result.pagination },
      diagnostics: {
        providersFailed: providerFailures,
        providersConfigured: result.configuredProviders.length,
        rawProviderHits,
        uniqueDiscovered: result.jobs.length,
        totalDiscovered,
        returned: result.jobs.length,
        applicationPaths,
        employerSources,
        providers: result.providers.map((provider) => ({ provider: provider.provider, status: provider.status, count: provider.count, totalCount: provider.totalCount ?? null, errorMessage: provider.errorMessage ?? null })),
      },
      policy: { directEmployerVerification: "public-source-evidence-required", fabricatedData: false, jobRequirements: "source-grounded-ai-analysis", pagination: "provider-backed" },
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
    const params = new URL(request.url).searchParams;
    const limitRaw = Number(params.get("limit") ?? 30);
    const pageRaw = Number(params.get("page") ?? 1);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(Math.floor(limitRaw), 100)) : 30;
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
    const history = await listPersistedJobs(auth, limit, (page - 1) * limit);
    return NextResponse.json({ jobs: history.jobs, pagination: { page, limit, total: history.total, hasMore: history.hasMore } }, { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "jobs_list_failed", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Saved job intelligence is temporarily unavailable." }, { status: 503 });
  }
}
