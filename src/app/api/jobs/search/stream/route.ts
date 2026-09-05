import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { runJobDiscovery } from "@/providers/jobs/router";
import { persistJobs } from "@/providers/jobs/persistence";
import { deterministicIntelligence } from "@/services/jobs/analysis";
import { researchJobs } from "@/services/jobs/source-research";
import type { JobProvider, JobProviderResult, JobSearchQuery, NormalizedJob } from "@/providers/jobs/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROVIDERS: JobProvider[] = ["adzuna", "jsearch", "jobspipe", "hirebase", "theirstack"];
const providerNames = new Set<JobProvider>(PROVIDERS);
type ProviderState = { provider: JobProvider; status: "queued" | "searching" | "researching" | "complete" | "failed"; count: number; researched?: number; totalCount?: number; nextCursor?: string; hasMore?: boolean; errorMessage?: string };
type StreamEvent =
  | { type: "status"; message: string; providers: ProviderState[] }
  | { type: "provider"; provider: JobProvider; result: JobProviderResult; jobs: NormalizedJob[]; providers: ProviderState[] }
  | { type: "complete"; jobs: NormalizedJob[]; providers: ProviderState[]; diagnostics: Record<string, unknown>; pagination: Record<string, { totalCount?: number; nextCursor?: string; hasMore: boolean }> };

function jsonLine(event: StreamEvent) { return `${JSON.stringify(event)}\n`; }
function normalizeIdentity(value?: string) { return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function jobIdentityKey(job: NormalizedJob) { return `${normalizeIdentity(job.companyDomain ?? job.companyName)}|${normalizeIdentity(job.title)}|${normalizeIdentity(job.city ?? job.location ?? job.countryCode ?? "")}|${job.remote ? "remote" : "onsite"}`; }
function mergeJobs(current: NormalizedJob[], incoming: NormalizedJob[]) {
  const byIdentity = new Map(current.map((job) => [jobIdentityKey(job), job]));
  for (const job of incoming) {
    const key = jobIdentityKey(job); const existing = byIdentity.get(key);
    if (!existing) { byIdentity.set(key, job); continue; }
    byIdentity.set(key, { ...existing, ...job, id: existing.id, description: (job.description?.length ?? 0) > (existing.description?.length ?? 0) ? job.description : existing.description, requirements: Array.from(new Set([...(existing.requirements ?? []), ...(job.requirements ?? [])])).slice(0, 16), companyPhone: job.companyPhone ?? existing.companyPhone, companyEmail: job.companyEmail ?? existing.companyEmail, companyWebsite: job.companyWebsite ?? existing.companyWebsite, companyDomain: job.companyDomain ?? existing.companyDomain, applyUrl: job.applyUrl ?? existing.applyUrl, sourceUrl: job.sourceUrl ?? existing.sourceUrl, sourceName: existing.sourceName ?? job.sourceName, verificationStatus: job.verificationScore != null || job.verificationStatus !== "unverified" ? job.verificationStatus : existing.verificationStatus, verificationScore: job.verificationScore ?? existing.verificationScore, verificationReasons: job.verificationReasons.length ? job.verificationReasons : existing.verificationReasons, verificationEvidence: job.verificationEvidence ?? existing.verificationEvidence });
  }
  return Array.from(byIdentity.values());
}
function withIntelligence(jobs: NormalizedJob[]) { return jobs.map((job) => ({ ...job, intelligence: deterministicIntelligence(job) })); }
function evidenceReady(job: NormalizedJob) { return Boolean(job.companyWebsite || job.applyUrl || job.companyPhone || job.companyEmail || job.verificationEvidence?.length); }

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Job title or search terms are required." }, { status: 400 });
  const limitRaw = Number(body?.limit ?? 50); const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50, 100));
  const pageRaw = Number(body?.page ?? 1); const page = Math.max(1, Math.min(Number.isFinite(pageRaw) ? Math.floor(pageRaw) : 1, 100));
  const selected = Array.isArray(body?.providers) ? body.providers.filter((value): value is JobProvider => typeof value === "string" && providerNames.has(value as JobProvider)) : PROVIDERS;
  const providers = selected.length ? selected : PROVIDERS;
  const remote = typeof body?.remote === "boolean" ? body.remote : undefined;
  const countryCode = typeof body?.countryCode === "string" ? body.countryCode.trim().toUpperCase() : undefined;
  const country = typeof body?.country === "string" ? body.country.trim() : undefined;
  const city = typeof body?.city === "string" ? body.city.trim() : undefined;
  const postedWithinDaysRaw = Number(body?.postedWithinDays ?? 30); const postedWithinDays = Number.isFinite(postedWithinDaysRaw) ? Math.max(1, Math.min(Math.floor(postedWithinDaysRaw), 90)) : 30;
  const cursors = body?.cursors && typeof body.cursors === "object" ? body.cursors as Record<string, unknown> : {};
  const query: JobSearchQuery = { title, country, countryCode, city, remote, limit, postedWithinDays, page, cursor: typeof cursors.jsearch === "string" ? cursors.jsearch : undefined };
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false; const write = (event: StreamEvent) => { if (!closed) controller.enqueue(encoder.encode(jsonLine(event))); };
      const states: ProviderState[] = providers.map((provider) => ({ provider, status: "queued", count: 0, researched: 0 })); const stateMap = new Map(states.map((state) => [state.provider, state]));
      const results = new Map<JobProvider, JobProviderResult>(); let cumulative: NormalizedJob[] = [];
      const priorityPerProvider = Math.max(1, Math.min(Number(process.env.JOB_STREAM_PRIORITY_RESEARCH_PER_PROVIDER) || 2, 4));
      try {
        write({ type: "status", message: "Vantage is connecting to live job sources.", providers: states });
        await Promise.all(providers.map(async (provider) => {
          const state = stateMap.get(provider)!; state.status = "searching"; write({ type: "status", message: `Vantage is querying ${provider}.`, providers: states });
          let result: JobProviderResult;
          try {
            const discovery = await runJobDiscovery(query, [provider], { verify: false });
            const summary = discovery.providers.find((item) => item.provider === provider);
            const providerJobs = discovery.jobs.filter((job) => job.provider === provider);
            const providerPage = discovery.pagination[provider];
            result = { provider, status: summary?.status ?? (providerJobs.length ? "success" : "zero-results"), jobs: providerJobs, totalCount: providerPage?.totalCount ?? undefined, errorMessage: summary?.errorMessage ?? undefined, hasMore: Boolean(providerPage?.hasMore), nextCursor: providerPage?.nextCursor ?? undefined };
          } catch (error) { result = { provider, status: "failed", jobs: [], errorMessage: error instanceof Error ? error.message : "Provider request failed." }; }
          results.set(provider, result); const incoming = withIntelligence(result.jobs); cumulative = mergeJobs(cumulative, incoming);
          state.count = result.jobs.length; state.totalCount = result.totalCount; state.nextCursor = result.nextCursor; state.hasMore = result.hasMore; state.errorMessage = result.errorMessage;
          try { if (incoming.length) await persistJobs(incoming, auth); } catch (error) { console.error(JSON.stringify({ diagnostic: "jobs_stream_persistence_failed", provider, message: error instanceof Error ? error.message : String(error) })); }
          write({ type: "provider", provider, result, jobs: cumulative, providers: states });
          if (result.jobs.length && result.status === "success") {
            state.status = "researching";
            write({ type: "status", message: `Vantage found ${result.jobs.length} ${provider} listings and is resolving employer sources and application paths.`, providers: states });
            try {
              const priorityJobs = result.jobs.filter((job) => !job.applyUrl || !job.companyWebsite || !job.companyPhone || !job.companyEmail).slice(0, priorityPerProvider);
              const researched = withIntelligence(await researchJobs(priorityJobs, priorityJobs.length));
              state.researched = researched.length;
              cumulative = mergeJobs(cumulative, researched);
              if (researched.length) await persistJobs(researched, auth);
              write({ type: "provider", provider, result: { ...result, jobs: researched }, jobs: cumulative, providers: states });
            } catch (error) {
              state.errorMessage = state.errorMessage ?? (error instanceof Error ? error.message : "Priority source research failed.");
              write({ type: "status", message: `Vantage is continuing without blocking on ${provider} research.`, providers: states });
            }
          }
          state.status = result.status === "failed" || result.status === "rate-limited" ? "failed" : "complete";
          write({ type: "status", message: `${provider} is complete. Vantage is keeping deeper employer research running in the background.`, providers: states });
        }));
        const pagination: Record<string, { totalCount?: number; nextCursor?: string; hasMore: boolean }> = {};
        for (const provider of providers) { const result = results.get(provider); pagination[provider] = { totalCount: result?.totalCount, nextCursor: result?.nextCursor, hasMore: Boolean(result?.hasMore) }; }
        const failures = states.filter((state) => state.status === "failed").length;
        const ready = cumulative.filter(evidenceReady).length;
        write({ type: "complete", jobs: cumulative, providers: states, pagination, diagnostics: { providersFailed: failures, providersConfigured: providers.length, rawProviderHits: states.reduce((sum, state) => sum + state.count, 0), dedupedReturned: cumulative.length, providerAdvertisedTotals: states.reduce((sum, state) => sum + (state.totalCount ?? 0), 0), returned: cumulative.length, applicationPaths: cumulative.filter((job) => Boolean(job.applyUrl)).length, employerSources: cumulative.filter((job) => Boolean(job.companyWebsite)).length, employerContacts: cumulative.filter((job) => Boolean(job.companyPhone || job.companyEmail)).length, evidenceReady: ready, aiAnalyzed: 0 } });
      } catch (error) { write({ type: "complete", jobs: cumulative, providers: states, pagination: {}, diagnostics: { streamError: error instanceof Error ? error.message : String(error), returned: cumulative.length, evidenceReady: cumulative.filter(evidenceReady).length } }); }
      finally { closed = true; controller.close(); }
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate", "X-Accel-Buffering": "no" } });
}
