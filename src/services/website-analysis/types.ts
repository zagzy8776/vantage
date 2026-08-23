import type { WebsiteAnalysisStrategy, WebsiteAnalysisStatus, WebsiteEvidence } from "@/lib/types";

export interface WebsiteAnalysisRequest {
  businessId: string;
  url: string;
  strategy: WebsiteAnalysisStrategy;
  force?: boolean;
}

export interface WebsiteAnalysisObservation {
  provider: "pagespeed" | string;
  businessId: string;
  url: string;
  strategy: WebsiteAnalysisStrategy;
  status: WebsiteAnalysisStatus;
  errorCode?: string | null;
  analyzedAt: string;
  performanceScore?: number | null;
  accessibilityScore?: number | null;
  bestPracticesScore?: number | null;
  seoScore?: number | null;
  httpStatus?: number;
  failureCategory?: string;
  reachability?: "reachable" | "unreachable" | "not-established";
}

export interface WebsiteAnalysisProvider {
  id: string;
  analyze(request: WebsiteAnalysisRequest): Promise<WebsiteAnalysisObservation>;
}

export interface WebsiteAnalysisResult {
  businessId: string;
  url: string;
  canonicalUrl: string;
  normalizedUrl: string;
  strategy?: WebsiteAnalysisStrategy;
  status: WebsiteAnalysisStatus;
  errorCode?: string | null;
  analyzedAt: string;
  reused: boolean;
  performanceScore?: number | null;
  accessibilityScore?: number | null;
  bestPracticesScore?: number | null;
  seoScore?: number | null;
  mobileScore?: number | null;
  desktopScore?: number | null;
  technicalHealthScore?: number | null;
  websiteStatus: "none" | "unknown" | "unreachable" | "poor" | "fair" | "good";
  evidence: WebsiteEvidence;
  httpStatus?: number;
  failureCategory?: string;
  reachability?: "reachable" | "unreachable" | "not-established";
}

export interface CachedWebsiteAnalysis {
  id: string;
  businessId: string;
  url: string;
  strategy: WebsiteAnalysisStrategy;
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  status: WebsiteAnalysisStatus;
  errorCode: string | null;
  analyzedAt: Date;
}