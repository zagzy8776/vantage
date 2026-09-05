import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/auth/middleware";
import { runJobDiscovery } from "@/providers/jobs/router";
import { persistJobs } from "@/providers/jobs/persistence";
import { deterministicIntelligence } from "@/services/jobs/analysis";
import type { JobProvider, JobProviderResult, JobSearchQuery, NormalizedJob } from "@/providers/jobs/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROVIDERS: JobProvider[] = ["adzuna", "jsearch", "jobspipe", "hirebase", "theirstack"];
const providerNames = new Set<JobProvider>(PROVIDERS);

type StreamEvent =
  | { type: "status"; message: string; providers: Array<{ provider: JobProvider; status: "queued" | "searching" | "complete" | "failed"; count: number; totalCount?: number; errorMessage?: string }> }
  | { type: "provider"; provider: JobProvider; result: JobProviderResult; jobs: NormalizedJob[]; providers: Array<{ provider: JobProvider; status: string; count: number; totalCount?: number; errorMessage?: string }> }
  | { type: "complete"; jobs: NormalizedJob[]; providers: Array<{ provider: JobProvider; status: string; count: number; totalCount?: number; errorMessage?: string }>; diagnostics: Record<string, unknown>; pagination: Record<string, { totalCount?: number; nextCursor?: string; hasMore: boolean }> };

function jsonLine(event: StreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

function mergeJobs(current: NormalizedJob[], incoming: NormalizedJob[]) {
  const byId = new Map(current.map((job) => [job.id, job]));
  for (const job of incoming) {
    const existing = byId.get(job.id);
    if (!existing) {
      byId.set(job.id, job);
      continue;
    }
    byId.set(job.id, {
      ...existing,
      ...job,
      companyPhone: job.companyPhone ?? existing.companyPhone,
      companyEmail: job.companyEmail ?? existing.companyEmail,
      companyWebsite: job.companyWebsite ?? existing.companyWebsite,
      companyDomain: job.companyDomain ?? existing.companyDomain,
      applyUrl: job.applyUrl ?? existing.applyUrl,
      sourceUrl: job.sourceUrl ?? existing.sourceUrl,
    });
  }
  return Array.from(byId.values());
}

function withIntelligence(jobs: NormalizedJob[]) {
  return jobs.map((job) => ({ ...job, intelligence: deterministicIntelligence(job) }));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Job title or search terms are required." }, { status: 400 });

  const limitRaw = Number(body?.limit ?? 50);
  const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50, 100));
  const pageRaw = Number(body?.page ?? 1);
  const page = Math.max(1, Math.min(Number.isFinite(pageRaw) ? Math.floor(pageRaw) : 1, 100));
  const selected = Array.isArray(body?.providers)
    ? body.providers.filter((value): value is JobProvider => typeof value === "string" && providerNames.has(value as JobProvider))
    : PROVIDERS;
  const providers = selected.length ? selected : PROVIDERS;
  const remote = typeof body?.remote === "boolean" ? body.remote : undefined;
  const countryCode = typeof body?.countryCode === "string" ? body.countryCode.trim().toUpperCase() : undefined;
  const country = typeof body?.country === "string" ? body.country.trim() : undefined;
  const city = typeof body?.city === "string" ? body.city.trim() : undefined;
  const postedWithinDaysRaw = Number(body?.postedWithinDays ?? 30);
  const postedWithinDays = Number.isFinite(postedWithinDaysRaw) ? Math.max(1, Math.min(Math.floor(postedWithinDaysRaw), 90)) : 30;
  const cursors = body?.cursors && typeof body.cursors === "object" ? body.cursors as Record<string, unknown> : {};

  const query: JobSearchQuery = { title, country, countryCode, city, remote, limit, postedWithinDays, page, cursor: typeof cursors.jsearch === "string" ? cursors.jsearch : undefined };
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const write = (event: StreamEvent) => {
        if (!closed) controller.enqueue(encoder.encode(jsonLine(event)));
      };
      const states = providers.map((provider) => ({ provider, status: "queued" as const, count: 0 }));
      const stateMap = new Map(states.map((state) => [state.provider, state]));
      let cumulative: NormalizedJob[] = [];

      try {
        write({ type: "status", message: "Vantage is connecting to live job sources.", providers: states });

        const tasks = providers.map(async (provider) => {
          const state = stateMap.get(provider)!;
          state.status = "searching";
          write({ type: "status", message: `Vantage is querying ${provider}.`, providers: states });

          let result: JobProviderResult;
          try {
            const discovery = await runJobDiscovery(query, [provider], { verify: false });
            result = discovery.providers[0] ?? { provider, status: "zero-results", jobs: [] };
          } catch (error) {
            result = { provider, status: "failed", jobs: [], errorMessage: error instanceof Error ? error.message : "Provider request failed." };
          }

          const incoming = withIntelligence(result.jobs);
          cumulative = mergeJobs(cumulative, incoming);
          state.status = result.status === "failed" || result.status === "rate-limited" ? "failed" : "complete";
          state.count = result.jobs.length;
          state.totalCount = result.totalCount;
          state.errorMessage = result.errorMessage;

          try {
            if (incoming.length) await persistJobs(incoming, auth);
          } catch (error) {
            console.error(JSON.stringify({ diagnostic: "jobs_stream_persistence_failed", provider, message: error instanceof Error ? error.message : String(error) }));
          }

          write({
            type: "provider",
            provider,
            result,
            jobs: cumulative,
            providers: states,
          });
        });

        await Promise.all(tasks);

        const pagination: Record<string, { totalCount?: number; nextCursor?: string; hasMore: boolean }> = {};
        for (const provider of providers) {
          const state = stateMap.get(provider)!;
          const providerResult = await runJobDiscovery(query, [provider], { verify: false }).catch(() => null);
          const result = providerResult?.providers[0];
          pagination[provider] = { totalCount: result?.totalCount, nextCursor: result?.nextCursor, hasMore: Boolean(result?.hasMore) };
          state.totalCount = result?.totalCount ?? state.totalCount;
        }

        const failures = states.filter((state) => state.status === "failed").length;
        write({
          type: "complete",
          jobs: cumulative,
          providers: states,
          pagination,
          diagnostics: {
            providersFailed: failures,
            providersConfigured: providers.length,
            rawProviderHits: states.reduce((sum, state) => sum + state.count, 0),
            dedupedReturned: cumulative.length,
            providerAdvertisedTotals: states.reduce((sum, state) => sum + (state.totalCount ?? 0), 0),
            returned: cumulative.length,
            applicationPaths: cumulative.filter((job) => Boolean(job.applyUrl)).length,
            employerSources: cumulative.filter((job) => Boolean(job.companyWebsite)).length,
            employerContacts: cumulative.filter((job) => Boolean(job.companyPhone || job.companyEmail)).length,
            evidenceReady: cumulative.length,
            aiAnalyzed: 0,
          },
        });
      } catch (error) {
        write({
          type: "complete",
          jobs: cumulative,
          providers: states,
          pagination: {},
          diagnostics: { streamError: error instanceof Error ? error.message : String(error), returned: cumulative.length },
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}
