import type { JobProvider } from "./types";

export type JobProviderHealthStatus = "healthy" | "zero-results" | "unavailable" | "rate-limited" | "failed";

export interface JobProviderHealth {
  provider: JobProvider;
  status: JobProviderHealthStatus;
  latencyMs: number;
  resultCount: number;
  checkedAt: string;
  errorMessage?: string;
}

const providers: JobProvider[] = ["adzuna", "jsearch", "jobspipe", "hirebase", "theirstack"];

function configured(provider: JobProvider) {
  if (provider === "adzuna") return Boolean(process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim());
  if (provider === "jsearch") return Boolean(process.env.OPENWEBNINJA_API_KEY?.trim());
  if (provider === "jobspipe") return Boolean(process.env.JOBSPIPE_API_KEY?.trim());
  if (provider === "hirebase") return Boolean(process.env.HIREBASE_API_KEY?.trim());
  return Boolean(process.env.THEIRSTACK_API_KEY?.trim());
}

async function check(provider: JobProvider): Promise<JobProviderHealth> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  if (!configured(provider)) return { provider, status: "unavailable", latencyMs: 0, resultCount: 0, checkedAt };

  try {
    let response: Response;
    if (provider === "adzuna") {
      const url = new URL("https://api.adzuna.com/v1/api/jobs/us/search/1");
      url.searchParams.set("app_id", process.env.ADZUNA_APP_ID!.trim());
      url.searchParams.set("app_key", process.env.ADZUNA_APP_KEY!.trim());
      url.searchParams.set("results_per_page", "1");
      url.searchParams.set("what", "software engineer");
      response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    } else if (provider === "jsearch") {
      const url = new URL("https://api.openwebninja.com/jsearch/search-v2");
      url.searchParams.set("query", "software engineer in United States");
      url.searchParams.set("country", "us");
      url.searchParams.set("language", "en");
      response = await fetch(url, { headers: { "x-api-key": process.env.OPENWEBNINJA_API_KEY!.trim() }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    } else if (provider === "jobspipe") {
      response = await fetch("https://api.jobspipe.dev/v1/jobs/search", { method: "POST", headers: { Authorization: `Bearer ${process.env.JOBSPIPE_API_KEY!.trim()}`, "Content-Type": "application/json" }, body: JSON.stringify({ job_title_or: ["software engineer"], limit: 1 }), cache: "no-store", signal: AbortSignal.timeout(10_000) });
    } else if (provider === "hirebase") {
      response = await fetch("https://api.hirebase.org/v2/jobs/search", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.HIREBASE_API_KEY!.trim() }, body: JSON.stringify({ job_titles: ["software engineer"], limit: 1 }), cache: "no-store", signal: AbortSignal.timeout(10_000) });
    } else {
      response = await fetch("https://api.theirstack.com/v1/jobs/search", { method: "POST", headers: { Authorization: `Bearer ${process.env.THEIRSTACK_API_KEY!.trim()}`, "Content-Type": "application/json" }, body: JSON.stringify({ job_title_or: ["software engineer"], limit: 1, page: 0, posted_at_max_age_days: 30 }), cache: "no-store", signal: AbortSignal.timeout(10_000) });
    }

    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body?.results) ? body.results : Array.isArray(body?.jobs) ? body.jobs : [];
    const status: JobProviderHealthStatus = response.status === 429 ? "rate-limited" : !response.ok ? "failed" : rows.length ? "healthy" : "zero-results";
    return { provider, status, latencyMs: Date.now() - started, resultCount: rows.length, checkedAt, errorMessage: response.ok ? undefined : `HTTP_${response.status}` };
  } catch (error) {
    return { provider, status: "failed", latencyMs: Date.now() - started, resultCount: 0, checkedAt, errorMessage: error instanceof Error ? error.message : "Provider health check failed." };
  }
}

export async function checkJobProviders() {
  return Promise.all(providers.map(check));
}
