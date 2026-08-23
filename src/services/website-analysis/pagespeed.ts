import type { WebsiteAnalysisObservation, WebsiteAnalysisProvider, WebsiteAnalysisRequest, WebsiteAnalysisResult as WebsiteAnalysisServiceResult } from "./types";
import type { WebsiteHealth } from "@/lib/types";

export interface NormalizedWebsiteUrl {
  inputUrl: string;
  normalizedUrl: string;
  canonicalUrl: string;
  hostname: string;
}

const TRACKING_PARAMS = [/^utm_/i, /^gclid$/i, /^fbclid$/i, /^mc_cid$/i, /^mc_eid$/i, /^ref$/i, /^igshid$/i];

export function normalizeWebsiteUrl(value: string): NormalizedWebsiteUrl | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const hasScheme = /^https?:\/\//i.test(trimmed);
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    url.hostname = url.hostname.toLowerCase().replace(/^www\./i, "");
    const params = Array.from(url.searchParams.entries());
    for (const [key] of params) {
      if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) url.searchParams.delete(key);
    }
    url.hash = "";

    const pathname = url.pathname.replace(/\/+$/, "");
    url.pathname = pathname || "/";

    const normalizedUrl = url.toString();
    return {
      inputUrl: trimmed,
      normalizedUrl,
      canonicalUrl: normalizedUrl,
      hostname: url.hostname,
    };
  } catch {
    return null;
  }
}

interface PageSpeedCategoryScore {
  score?: number | null;
}

interface PageSpeedLighthouseResult {
  fetchTime?: string;
  requestedUrl?: string;
  finalUrl?: string;
  categories?: Record<string, PageSpeedCategoryScore>;
}

interface PageSpeedResultResponse {
  lighthouseResult?: PageSpeedLighthouseResult;
  error?: { code?: string; message?: string };
  runtimeError?: { code?: string; message?: string };
}

export interface PageSpeedNormalizedResponse extends WebsiteAnalysisObservation {
  finalUrl?: string;
  requestedUrl?: string;
  httpStatus?: number;
  failureCategory?: "authentication" | "quota" | "provider_error" | "timeout" | "network" | "runtime_error" | "malformed_response";
}

function toScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value <= 1 ? value * 100 : value);
  return Math.max(0, Math.min(100, rounded));
}

function normalizeResponse(response: PageSpeedResultResponse | null | undefined, request: WebsiteAnalysisRequest): PageSpeedNormalizedResponse {
  const lighthouseResult = response?.lighthouseResult;
  const performanceScore = toScore(lighthouseResult?.categories?.performance?.score);
  const accessibilityScore = toScore(lighthouseResult?.categories?.accessibility?.score);
  const bestPracticesScore = toScore(lighthouseResult?.categories?.["best-practices"]?.score);
  const seoScore = toScore(lighthouseResult?.categories?.seo?.score);
  const analyzedAt = lighthouseResult?.fetchTime ?? new Date().toISOString();

  const hasScores = [performanceScore, accessibilityScore, bestPracticesScore, seoScore].some((value) => typeof value === "number");
  if (!hasScores) {
    const errorCode = response?.runtimeError?.code ?? response?.error?.code ?? "malformed-response";
    return {
      provider: "pagespeed",
      businessId: request.businessId,
      url: request.url,
      strategy: request.strategy,
      status: "failed",
      reachability: errorCode === "network-failure" || errorCode === "timeout" ? "unreachable" : "not-established",
      errorCode,
      analyzedAt,
      performanceScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      seoScore: null,
      finalUrl: lighthouseResult?.finalUrl,
      requestedUrl: lighthouseResult?.requestedUrl,
      failureCategory: errorCode === "NO_FCP" ? "runtime_error" : "malformed_response",
    };
  }

  return {
    provider: "pagespeed",
    businessId: request.businessId,
    url: request.url,
    strategy: request.strategy,
    status: "success",
    reachability: "not-established",
    errorCode: null,
    analyzedAt,
    performanceScore,
    accessibilityScore,
    bestPracticesScore,
    seoScore,
    finalUrl: lighthouseResult?.finalUrl,
    requestedUrl: lighthouseResult?.requestedUrl,
  };
}

export async function runPageSpeedAnalysis(request: WebsiteAnalysisRequest): Promise<PageSpeedNormalizedResponse> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    return {
      provider: "pagespeed",
      businessId: request.businessId,
      url: request.url,
      strategy: request.strategy,
      status: "failed",
      errorCode: "missing-api-key",
      analyzedAt: new Date().toISOString(),
      performanceScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      seoScore: null,
    };
  }

  const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  url.searchParams.set("url", request.url);
  url.searchParams.set("strategy", request.strategy);
  url.searchParams.set("locale", "en-US");
  ["performance", "accessibility", "best-practices", "seo"].forEach((category) => url.searchParams.append("category", category));
  url.searchParams.set("key", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url.toString(), { method: "GET", cache: "no-store", signal: controller.signal });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as PageSpeedResultResponse | null;
      const providerCode = payload?.runtimeError?.code ?? payload?.error?.code ?? (response.status === 429 ? "rate-limited" : response.status >= 500 ? "service-unavailable" : "request-failed");
      const failureCategory = providerCode === "NO_FCP" ? "runtime_error" : response.status === 401 || response.status === 403 ? "authentication" : response.status === 429 ? "quota" : response.status >= 500 ? "provider_error" : "provider_error";
      return { ...normalizeResponse({ ...payload, error: payload?.error ?? { code: providerCode }, runtimeError: payload?.runtimeError ?? { code: providerCode, message: `PageSpeed request failed with status ${response.status}` } }, request), httpStatus: response.status, failureCategory };
    }

    const payload = (await response.json().catch(() => null)) as PageSpeedResultResponse | null;
    return normalizeResponse(payload, request);
  } catch (error) {
    const code = error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network-failure";
    return {
      provider: "pagespeed",
      businessId: request.businessId,
      url: request.url,
      strategy: request.strategy,
      status: "failed",
      errorCode: code,
      failureCategory: code === "timeout" ? "timeout" : "network",
      reachability: code === "timeout" || code === "network-failure" ? "unreachable" : "not-established",
      analyzedAt: new Date().toISOString(),
      performanceScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      seoScore: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const pageSpeedAnalysisProvider: WebsiteAnalysisProvider = {
  id: "pagespeed",
  analyze: runPageSpeedAnalysis,
};

export function calculateTechnicalWebsiteHealth(analysis: {
  status: "success" | "failed";
  performanceScore?: number | null;
  accessibilityScore?: number | null;
  bestPracticesScore?: number | null;
  seoScore?: number | null;
  errorCode?: string | null;
}): { technicalHealthScore: number | null; websiteStatus: WebsiteHealth } {
  if (analysis.status === "failed") {
    const code = analysis.errorCode ?? "unknown";
    return {
      technicalHealthScore: null,
      websiteStatus: code === "network-failure" || code === "timeout" ? "unreachable" : "unknown",
    };
  }

  const scores = [analysis.performanceScore, analysis.accessibilityScore, analysis.bestPracticesScore, analysis.seoScore].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );

  if (!scores.length) {
    return { technicalHealthScore: null, websiteStatus: "unknown" };
  }

  const performance = analysis.performanceScore ?? scores[0];
  const accessibility = analysis.accessibilityScore ?? performance;
  const bestPractices = analysis.bestPracticesScore ?? performance;
  const seo = analysis.seoScore ?? performance;
  const technicalHealthScore = Math.round(performance * 0.4 + accessibility * 0.2 + bestPractices * 0.2 + seo * 0.2);

  if (technicalHealthScore >= 80) return { technicalHealthScore, websiteStatus: "good" };
  if (technicalHealthScore >= 65) return { technicalHealthScore, websiteStatus: "fair" };
  return { technicalHealthScore, websiteStatus: "poor" };
}

export function buildWebsiteEvidence(input: {
  hasWebsite: boolean;
  reachable?: boolean;
  reachability?: "reachable" | "unreachable" | "not-established";
  analysisStatus?: "success" | "failed";
  mobileScore?: number | null;
  desktopScore?: number | null;
  performanceScore?: number | null;
  accessibilityScore?: number | null;
  bestPracticesScore?: number | null;
  seoScore?: number | null;
}): WebsiteAnalysisServiceResult["evidence"] {
  return {
    hasWebsite: input.hasWebsite,
    ...(input.reachable !== undefined ? { reachable: input.reachable } : {}),
    reachability: input.reachability ?? "not-established",
    analysisStatus: input.analysisStatus,
    mobilePerformance: input.mobileScore ?? undefined,
    desktopPerformance: input.desktopScore ?? undefined,
    performance: input.performanceScore ?? undefined,
    accessibility: input.accessibilityScore ?? undefined,
    bestPractices: input.bestPracticesScore ?? undefined,
    seo: input.seoScore ?? undefined,
  };
}