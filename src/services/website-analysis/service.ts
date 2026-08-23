import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { businesses, leads, websiteAnalyses } from "@/lib/db/schema";
import { calculateTechnicalWebsiteHealth, buildWebsiteEvidence, normalizeWebsiteUrl, pageSpeedAnalysisProvider } from "./pagespeed";
import type { CachedWebsiteAnalysis, WebsiteAnalysisObservation, WebsiteAnalysisResult as WebsiteAnalysisServiceResult } from "./types";

const DEFAULT_REANALYZE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_LIMIT = 5;
const DEFAULT_CONCURRENCY = 2;

function resolveReanalysisIntervalMs() {
  const raw = process.env.WEBSITE_ANALYSIS_REANALYZE_HOURS;
  if (!raw) return DEFAULT_REANALYZE_INTERVAL_MS;
  const hours = Number(raw);
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60 * 60 * 1000) : DEFAULT_REANALYZE_INTERVAL_MS;
}

export function isBusinessIdValid(businessId: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(businessId);
}

async function loadBusinessById(businessId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      website: businesses.website,
      websiteCanonicalUrl: businesses.websiteCanonicalUrl,
      websiteNormalizedUrl: businesses.websiteNormalizedUrl,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getLatestWebsiteAnalysis(businessId: string): Promise<CachedWebsiteAnalysis | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: websiteAnalyses.id,
      businessId: websiteAnalyses.businessId,
      url: websiteAnalyses.url,
      strategy: websiteAnalyses.strategy,
      performanceScore: websiteAnalyses.performanceScore,
      accessibilityScore: websiteAnalyses.accessibilityScore,
      bestPracticesScore: websiteAnalyses.bestPracticesScore,
      seoScore: websiteAnalyses.seoScore,
      status: websiteAnalyses.status,
      errorCode: websiteAnalyses.errorCode,
      analyzedAt: websiteAnalyses.analyzedAt,
    })
    .from(websiteAnalyses)
    .where(eq(websiteAnalyses.businessId, businessId))
    .orderBy(desc(websiteAnalyses.analyzedAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function getLatestWebsiteAnalyses(businessId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: websiteAnalyses.id,
      businessId: websiteAnalyses.businessId,
      url: websiteAnalyses.url,
      strategy: websiteAnalyses.strategy,
      performanceScore: websiteAnalyses.performanceScore,
      accessibilityScore: websiteAnalyses.accessibilityScore,
      bestPracticesScore: websiteAnalyses.bestPracticesScore,
      seoScore: websiteAnalyses.seoScore,
      status: websiteAnalyses.status,
      errorCode: websiteAnalyses.errorCode,
      analyzedAt: websiteAnalyses.analyzedAt,
    })
    .from(websiteAnalyses)
    .where(eq(websiteAnalyses.businessId, businessId))
    .orderBy(desc(websiteAnalyses.analyzedAt))
    .limit(10);

  return rows;
}

async function syncWebsiteStatus(businessId: string, summary: WebsiteAnalysisServiceResult) {
  const db = getDb();
  const now = new Date();
  const websiteUpdates = summary.normalizedUrl
    ? {
        website: summary.normalizedUrl,
        websiteCanonicalUrl: summary.canonicalUrl,
        websiteNormalizedUrl: summary.normalizedUrl,
      }
    : {};

  await db.update(businesses).set({
    ...websiteUpdates,
    updatedAt: now,
  }).where(eq(businesses.id, businessId));

  await db.update(leads).set({
    websiteStatus: summary.websiteStatus,
    updatedAt: now,
  }).where(eq(leads.businessId, businessId));
}

function toAnalysisResult(observation: WebsiteAnalysisObservation, urlInfo: NonNullable<ReturnType<typeof normalizeWebsiteUrl>>, reused: boolean): WebsiteAnalysisServiceResult {
  const technical = calculateTechnicalWebsiteHealth(observation);
  return {
    businessId: observation.businessId,
    url: observation.url,
    canonicalUrl: urlInfo.canonicalUrl,
    normalizedUrl: urlInfo.normalizedUrl,
    strategy: observation.strategy,
    status: observation.status,
    errorCode: observation.errorCode ?? null,
    httpStatus: observation.httpStatus,
    failureCategory: observation.failureCategory,
    reachability: observation.reachability ?? "not-established",
    analyzedAt: observation.analyzedAt,
    reused,
    performanceScore: observation.performanceScore ?? null,
    accessibilityScore: observation.accessibilityScore ?? null,
    bestPracticesScore: observation.bestPracticesScore ?? null,
    seoScore: observation.seoScore ?? null,
    mobileScore: observation.strategy === "mobile" ? observation.performanceScore ?? null : null,
    desktopScore: observation.strategy === "desktop" ? observation.performanceScore ?? null : null,
    technicalHealthScore: technical.technicalHealthScore,
    websiteStatus: technical.websiteStatus,
    evidence: buildWebsiteEvidence({
      hasWebsite: true,
      reachability: observation.reachability ?? "not-established",
      analysisStatus: observation.status,
      mobileScore: observation.strategy === "mobile" ? observation.performanceScore ?? null : null,
      desktopScore: observation.strategy === "desktop" ? observation.performanceScore ?? null : null,
      performanceScore: observation.performanceScore ?? null,
      accessibilityScore: observation.accessibilityScore ?? null,
      bestPracticesScore: observation.bestPracticesScore ?? null,
      seoScore: observation.seoScore ?? null,
    }),
  };
}

async function persistAnalysis(observation: WebsiteAnalysisObservation, urlInfo: NonNullable<ReturnType<typeof normalizeWebsiteUrl>>, businessId: string, runId?: string) {
  const db = getDb();
  const analysisId = `wa_${businessId}_${observation.strategy}_${Date.now()}`;
  await db.insert(websiteAnalyses).values({
    id: analysisId,
    businessId,
    runId: runId ?? null,
    url: urlInfo.normalizedUrl,
    strategy: observation.strategy,
    performanceScore: observation.performanceScore ?? null,
    accessibilityScore: observation.accessibilityScore ?? null,
    bestPracticesScore: observation.bestPracticesScore ?? null,
    seoScore: observation.seoScore ?? null,
    status: observation.status,
    errorCode: observation.errorCode ?? null,
    analyzedAt: new Date(observation.analyzedAt),
  });
}

export async function analyzeBusinessWebsite(businessId: string, options?: { force?: boolean; runId?: string }): Promise<WebsiteAnalysisServiceResult> {
  if (!isBusinessIdValid(businessId)) {
    throw new Error("Invalid business ID.");
  }

  const business = await loadBusinessById(businessId);
  if (!business) {
    throw new Error("Business not found.");
  }

  const website = business.websiteNormalizedUrl ?? business.website ?? null;
  if (!website) {
    const summary: WebsiteAnalysisServiceResult = {
      businessId,
      url: "",
      canonicalUrl: "",
      normalizedUrl: "",
      status: "failed",
      errorCode: "no-website",
      analyzedAt: new Date().toISOString(),
      reused: false,
      performanceScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      seoScore: null,
      mobileScore: null,
      desktopScore: null,
      technicalHealthScore: null,
      websiteStatus: "none",
      evidence: { hasWebsite: false, reachability: "not-established", analysisStatus: "failed" },
    };
    await syncWebsiteStatus(businessId, summary);
    return summary;
  }

  const normalized = normalizeWebsiteUrl(website);
  if (!normalized) {
    const summary: WebsiteAnalysisServiceResult = {
      businessId,
      url: website,
      canonicalUrl: website,
      normalizedUrl: website,
      status: "failed",
      errorCode: "invalid-url",
      analyzedAt: new Date().toISOString(),
      reused: false,
      performanceScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      seoScore: null,
      mobileScore: null,
      desktopScore: null,
      technicalHealthScore: null,
      websiteStatus: "unknown",
      evidence: { hasWebsite: true, reachability: "not-established", analysisStatus: "failed" },
    };
    await syncWebsiteStatus(businessId, summary);
    return summary;
  }

  const latest = await getLatestWebsiteAnalysis(businessId);
  const freshWindowMs = resolveReanalysisIntervalMs();
  const freshEnough = latest && !options?.force && Date.now() - latest.analyzedAt.getTime() < freshWindowMs;

  if (freshEnough) {
    const observation: WebsiteAnalysisObservation = {
      provider: "pagespeed",
      businessId,
      url: latest.url,
      strategy: latest.strategy,
      status: latest.status,
      errorCode: latest.errorCode,
      analyzedAt: latest.analyzedAt.toISOString(),
      performanceScore: latest.performanceScore,
      accessibilityScore: latest.accessibilityScore,
      bestPracticesScore: latest.bestPracticesScore,
      seoScore: latest.seoScore,
    };
    const summary = toAnalysisResult(observation, normalized, true);
    await syncWebsiteStatus(businessId, summary);
    return summary;
  }

  const mobile = await pageSpeedAnalysisProvider.analyze({ businessId, url: normalized.normalizedUrl, strategy: "mobile", force: options?.force });
  const desktop = await pageSpeedAnalysisProvider.analyze({ businessId, url: normalized.normalizedUrl, strategy: "desktop", force: options?.force });

  await persistAnalysis(mobile, normalized, businessId, options?.runId);
  await persistAnalysis(desktop, normalized, businessId, options?.runId);

  const { storeEvidence } = await import("@/services/evidence/service");
  const websiteEvidence = buildWebsiteEvidence({
    hasWebsite: true,
    reachability: mobile.reachability === "reachable" || desktop.reachability === "reachable" ? "reachable" : mobile.reachability === "unreachable" && desktop.reachability === "unreachable" ? "unreachable" : "not-established",
    analysisStatus: mobile.status === "success" || desktop.status === "success" ? "success" : "failed",
    mobileScore: mobile.performanceScore ?? null,
    desktopScore: desktop.performanceScore ?? null,
    performanceScore: (mobile.status === "success" ? mobile : desktop).performanceScore ?? null,
    accessibilityScore: (mobile.status === "success" ? mobile : desktop).accessibilityScore ?? null,
    bestPracticesScore: (mobile.status === "success" ? mobile : desktop).bestPracticesScore ?? null,
    seoScore: (mobile.status === "success" ? mobile : desktop).seoScore ?? null,
  });
  const pageSpeedEvidence = [
    ...(mobile.status === "success" || desktop.status === "success" ? [{ businessId, category: "technology" as const, statement: "PageSpeed analysis completed successfully for the submitted URL.", value: "success", sourceType: "pagespeed" as const, sourceUrl: normalized.normalizedUrl, confidence: "high" as const, observedAt: new Date().toISOString(), metadata: { runId: options?.runId } }] : []),
    ...[mobile, desktop].filter((observation) => observation.status === "failed" && observation.errorCode).map((observation) => ({ businessId, category: "technology" as const, statement: `PageSpeed returned runtime error: ${observation.errorCode}.`, value: observation.errorCode!, sourceType: "pagespeed" as const, sourceUrl: normalized.normalizedUrl, confidence: "high" as const, observedAt: new Date().toISOString(), metadata: { runId: options?.runId, strategy: observation.strategy } })),
    ...Object.entries(websiteEvidence).filter(([key, value]) => value !== undefined && value !== null && key !== "analysisStatus" && key !== "reachability").map(([key, value]) => ({ businessId, category: "technology" as const, statement: `PageSpeed reported ${key} for the official website.`, value: String(value), sourceType: "pagespeed" as const, sourceUrl: normalized.normalizedUrl, confidence: "high" as const, observedAt: new Date().toISOString(), metadata: { runId: options?.runId } })),
  ];
  await storeEvidence(pageSpeedEvidence, { runId: options?.runId });

  const primary = mobile.status === "success" ? mobile : desktop;
  const summary = toAnalysisResult(primary, normalized, false);
  summary.mobileScore = mobile.performanceScore ?? null;
  summary.desktopScore = desktop.performanceScore ?? null;
  summary.evidence = buildWebsiteEvidence({
    hasWebsite: true,
    reachability: websiteEvidence.reachability,
    analysisStatus: websiteEvidence.analysisStatus,
    mobileScore: mobile.performanceScore ?? null,
    desktopScore: desktop.performanceScore ?? null,
    performanceScore: primary.performanceScore ?? null,
    accessibilityScore: primary.accessibilityScore ?? null,
    bestPracticesScore: primary.bestPracticesScore ?? null,
    seoScore: primary.seoScore ?? null,
  });

  await syncWebsiteStatus(businessId, summary);
  return summary;
}

export async function analyzeBusinesses(businessIds: string[], options?: { force?: boolean; maxConcurrency?: number; limit?: number }) {
  const limit = options?.limit ?? DEFAULT_BATCH_LIMIT;
  if (businessIds.length > limit) {
    throw new Error(`Batch analysis is limited to ${limit} businesses.`);
  }

  const concurrency = Math.max(1, Math.min(options?.maxConcurrency ?? DEFAULT_CONCURRENCY, limit));
  const queue = [...businessIds];
  const results: Array<WebsiteAnalysisServiceResult & { businessId: string }> = [];

  async function worker() {
    while (queue.length) {
      const businessId = queue.shift();
      if (!businessId) return;
      try {
        const result = await analyzeBusinessWebsite(businessId, { force: options?.force });
        results.push(result);
      } catch (error) {
        results.push({
          businessId,
          url: "",
          canonicalUrl: "",
          normalizedUrl: "",
          status: "failed",
          errorCode: error instanceof Error ? error.message : "unknown",
          analyzedAt: new Date().toISOString(),
          reused: false,
          performanceScore: null,
          accessibilityScore: null,
          bestPracticesScore: null,
          seoScore: null,
          mobileScore: null,
          desktopScore: null,
          technicalHealthScore: null,
          websiteStatus: "unknown",
          evidence: { hasWebsite: false, reachability: "not-established", analysisStatus: "failed" },
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));

  return {
    results,
    total: results.length,
    successCount: results.filter((result) => result.status === "success").length,
    failureCount: results.filter((result) => result.status === "failed").length,
    reusedCount: results.filter((result) => result.reused).length,
  };
}