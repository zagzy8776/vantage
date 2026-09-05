import type { EvidenceSearchQuery, EvidenceSearchResult, EvidenceSearchResultItem } from "@/services/evidence/types";
import { EvidenceSearchProviderError, type EvidenceSearchProvider } from "./types";

interface TavilyPayload {
  results?: Array<{ title?: string; url?: string; content?: string; published_date?: string; score?: number }>;
  query?: string;
}

export class TavilyEvidenceSearchProvider implements EvidenceSearchProvider {
  name = "tavily" as const;

  async search(query: EvidenceSearchQuery): Promise<EvidenceSearchResult> {
    const apiKey = process.env.TAVILY_API_KEY?.trim();
    if (!apiKey) return { provider: this.name, status: "unavailable", results: [], evidence: [], queryCount: 0, errorMessage: "TAVILY_API_KEY is not configured." };
    const searchQuery = query.query ?? [query.businessName, query.category, query.location].filter(Boolean).join(" ");
    const deep = query.category === "employment" || /\b(careers?|jobs?|apply|hiring|employer|recruit|contact|phone|email)\b/i.test(searchQuery);
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, topic: "general", search_depth: deep ? "advanced" : "basic", max_results: Math.min(Math.max(query.limit, 1), 10), include_answer: false, include_raw_content: deep, include_images: false, ...(query.country ? { country: query.country } : {}) }),
        cache: "no-store",
        signal: AbortSignal.timeout(Number(process.env.WEB_SEARCH_TIMEOUT_MS) || 20_000),
      });
      const payload = (await response.json().catch(() => null)) as TavilyPayload | null;
      if (!response.ok) throw new EvidenceSearchProviderError(payload ? "Tavily search request failed." : "Tavily returned an invalid error response.", { retryable: response.status === 408 || response.status === 429 || response.status >= 500, status: response.status });
      if (!payload || !Array.isArray(payload.results)) return { provider: this.name, status: "malformed-response", results: [], evidence: [], queryCount: 1, errorMessage: "Malformed Tavily search response." };
      const results: EvidenceSearchResultItem[] = payload.results.filter((item) => typeof item.title === "string" && typeof item.url === "string").map((item, index) => ({ title: item.title!, url: item.url!, snippet: item.content, rank: index + 1, publishedAt: item.published_date, metadata: { score: item.score, query: searchQuery } }));
      return { provider: this.name, status: results.length ? "success" : "zero-results", results, evidence: [], queryCount: 1 };
    } catch (error) {
      if (error instanceof EvidenceSearchProviderError) return { provider: this.name, status: error.status === 401 || error.status === 403 ? "failed" : error.status === 429 ? "rate-limited" : error.retryable ? "failed" : "unavailable", results: [], evidence: [], queryCount: 1, errorMessage: error.status === 401 || error.status === 403 ? "Tavily authentication failed." : "Tavily search was unavailable." };
      return { provider: this.name, status: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "failed", results: [], evidence: [], queryCount: 1, errorMessage: "Tavily search was unavailable." };
    }
  }
}

export const tavilyEvidenceSearchProvider = new TavilyEvidenceSearchProvider();
