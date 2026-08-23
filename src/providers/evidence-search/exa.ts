import type { EvidenceSearchQuery, EvidenceSearchResult, EvidenceSearchResultItem } from "@/services/evidence/types";
import { EvidenceSearchProviderError, type EvidenceSearchProvider } from "./types";

interface ExaPayload {
  results?: Array<{ title?: string; url?: string; text?: string; highlights?: string[]; publishedDate?: string; author?: string }>;
}

export class ExaEvidenceSearchProvider implements EvidenceSearchProvider {
  name = "exa" as const;

  async search(query: EvidenceSearchQuery): Promise<EvidenceSearchResult> {
    const apiKey = process.env.EXA_API_KEY?.trim();
    if (!apiKey) return { provider: this.name, status: "unavailable", results: [], evidence: [], queryCount: 0, errorMessage: "EXA_API_KEY is not configured." };
    const searchQuery = query.query ?? [query.businessName, query.category, query.location].filter(Boolean).join(" ");
    const startedAt = Date.now();
    try {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, type: "fast", category: "company", userLocation: query.country, numResults: Math.min(Math.max(query.limit, 1), 10), contents: { highlights: { maxCharacters: 400 } } }),
        cache: "no-store",
        signal: AbortSignal.timeout(Number(process.env.WEB_SEARCH_TIMEOUT_MS) || 20_000),
      });
      const payload = (await response.json().catch(() => null)) as ExaPayload | null;
      if (!response.ok) throw new EvidenceSearchProviderError("Exa search request failed.", { retryable: response.status === 408 || response.status === 429 || response.status >= 500, status: response.status });
      if (!payload || !Array.isArray(payload.results)) return { provider: this.name, status: "malformed-response", results: [], evidence: [], queryCount: 1, errorMessage: "Malformed Exa search response." };
      const results: EvidenceSearchResultItem[] = payload.results.filter((item) => typeof item.title === "string" && typeof item.url === "string").map((item, index) => ({ title: item.title!, url: item.url!, snippet: item.highlights?.[0] ?? item.text, rank: index + 1, publishedAt: item.publishedDate, metadata: { author: item.author, query: searchQuery } }));
      return { provider: this.name, status: results.length ? "success" : "zero-results", results, evidence: [], queryCount: 1, durationMs: Date.now() - startedAt, providerDiagnostics: [{ durationMs: Date.now() - startedAt }] };
    } catch (error) {
      if (error instanceof EvidenceSearchProviderError) return { provider: this.name, status: error.status === 401 || error.status === 403 ? "failed" : error.status === 429 ? "rate-limited" : error.retryable ? "failed" : "unavailable", results: [], evidence: [], queryCount: 1, errorMessage: error.status === 401 || error.status === 403 ? "Exa authentication failed." : "Exa search was unavailable.", httpStatus: error.status, failureCategory: error.status === 401 || error.status === 403 ? "authentication" : error.status === 429 ? "rate_limit" : "provider_error", durationMs: Date.now() - startedAt, providerDiagnostics: [{ httpStatus: error.status, failureCategory: error.status === 401 || error.status === 403 ? "authentication" : error.status === 429 ? "rate_limit" : "provider_error", safeMessage: error.status === 401 || error.status === 403 ? "Exa authentication failed." : "Exa search was unavailable.", durationMs: Date.now() - startedAt }] };
      return { provider: this.name, status: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "failed", results: [], evidence: [], queryCount: 1, errorMessage: "Exa search was unavailable.", failureCategory: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network", durationMs: Date.now() - startedAt, providerDiagnostics: [{ failureCategory: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network", safeMessage: "Exa search was unavailable.", durationMs: Date.now() - startedAt }] };
    }
  }
}

export const exaEvidenceSearchProvider = new ExaEvidenceSearchProvider();