import { dedupeEvidence } from "@/services/evidence/dedupe";
import { extractInternalLinks, selectResearchLinks, isPermittedPublicUrl } from "@/services/evidence/collector";
import { normalizeEvidenceItem, normalizeEvidenceText } from "@/services/evidence/normalizer";
import type { EvidenceItem, WebsiteResearchDiagnostic } from "@/services/evidence/types";
import type { WebsiteResearchProvider, WebsiteResearchProviderRequest, WebsiteResearchProviderResult } from "./types";

interface FirecrawlResponse {
  success?: boolean;
  data?: { markdown?: string; html?: string; metadata?: { title?: string; description?: string; sourceURL?: string } };
  error?: string;
}

function textSignals(businessId: string, url: string, markdown: string, observedAt: string): EvidenceItem[] {
  const text = normalizeEvidenceText(markdown);
  const lower = text.toLowerCase();
  const result: EvidenceItem[] = [];
  const add = (category: EvidenceItem["category"], statement: string, value?: string) => {
    const item = normalizeEvidenceItem({ businessId, category, statement, value, sourceType: "firecrawl", sourceUrl: url, explicit: true, observedAt });
    if (item) result.push(item);
  };
  if (text) add("content_signal", "Firecrawl extracted public page content for evidence analysis.", text.slice(0, 600));
  if (/(book|booking|appointment|reserve|reservation|schedule)/i.test(lower)) add("booking", "Firecrawl-extracted public content contains booking or appointment language.");
  if (/(cart|checkout|shop|store|product|buy now|add to cart|\$\s?\d+|€\s?\d+|£\s?\d+)/i.test(lower)) add("ecommerce", "Firecrawl-extracted public content contains e-commerce, product, or pricing signals.");
  if (/(service|treatment|menu|solutions|what we offer)/i.test(lower)) add("services", "Firecrawl-extracted public content contains a services or offerings signal.");
  if (/contact|inquiry|mailto:|tel:|\b\+?\d[\d\s().-]{6,}\d\b/i.test(text)) add("contact", "Firecrawl-extracted public content contains contact information or contact language.");
  if (/instagram\.com|facebook\.com|tiktok\.com|linkedin\.com/i.test(text)) add("social_presence", "Firecrawl-extracted public content contains public social-profile links.");
  return result;
}

export class FirecrawlWebsiteResearchProvider implements WebsiteResearchProvider {
  name = "firecrawl" as const;

  async research(request: WebsiteResearchProviderRequest): Promise<WebsiteResearchProviderResult> {
    const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
    if (!apiKey) return { provider: this.name, pagesFetched: [], evidence: [], errors: ["FIRECRAWL_API_KEY is not configured."] };
    if (!isPermittedPublicUrl(request.url)) return { provider: this.name, pagesFetched: [], evidence: [], errors: ["Website URL is not a permitted public URL."] };
    const maxPages = Math.min(Math.max(request.maxPages, 1), 5);
    const pagesFetched: string[] = [];
    const evidence: EvidenceItem[] = [];
    const errors: string[] = [];
    const diagnostics: WebsiteResearchDiagnostic[] = [];
    const observedAt = new Date().toISOString();
    const scrape = async (url: string) => {
      const startedAt = Date.now();
      let response: Response;
      try {
        response = await fetch("https://api.firecrawl.dev/v2/scrape", { 
          method: "POST", 
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, 
          body: JSON.stringify({ 
            url, 
            formats: ["markdown", "html"], 
            onlyMainContent: true,
            timeout: Number(process.env.FIRECRAWL_TIMEOUT_MS) || 60_000
          }), 
          cache: "no-store", 
          signal: AbortSignal.timeout(Number(process.env.FIRECRAWL_TIMEOUT_MS) || 60_000) 
        });
      } catch (error) {
        diagnostics.push({ domain: new URL(url).hostname, failureCategory: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network", safeMessage: "Firecrawl request could not be completed.", requestConstructed: true, timedOut: error instanceof DOMException && error.name === "TimeoutError", durationMs: Date.now() - startedAt });
        throw error;
      }
      const payload = (await response.json().catch(() => null)) as FirecrawlResponse | null;
      if (!response.ok || !payload?.success) {
        const safeMessage = payload?.error || `Firecrawl request failed with status ${response.status}.`;
        diagnostics.push({ domain: new URL(url).hostname, httpStatus: response.status, failureCategory: response.status === 401 || response.status === 403 ? "authentication" : response.status === 429 ? "rate_limit" : response.status >= 500 ? "provider_error" : /unrecognized key|invalid|schema/i.test(safeMessage) ? "request_schema" : "provider_error", safeMessage: safeMessage.slice(0, 240), requestConstructed: true, durationMs: Date.now() - startedAt });
        throw new Error(safeMessage);
      }
      diagnostics.push({ domain: new URL(url).hostname, httpStatus: response.status, requestConstructed: true, durationMs: Date.now() - startedAt });
      return payload.data ?? {};
    };
    try {
      const homepage = await scrape(request.url);
      pagesFetched.push(request.url);
      evidence.push(...textSignals(request.businessId, request.url, homepage.markdown ?? homepage.html ?? "", observedAt));
      const links = homepage.html ? selectResearchLinks(extractInternalLinks(homepage.html, request.url), maxPages) : [];
      for (const url of links) {
        if (pagesFetched.length >= maxPages) break;
        try {
          const page = await scrape(url);
          pagesFetched.push(url);
          evidence.push(...textSignals(request.businessId, url, page.markdown ?? page.html ?? "", observedAt));
        } catch (error) { errors.push(`${url}: ${error instanceof Error ? error.message : "Firecrawl page failed."}`); }
      }
    } catch (error) { errors.push(error instanceof Error ? error.message : "Firecrawl research failed."); }
    return { provider: this.name, pagesFetched, evidence: dedupeEvidence(evidence), errors, diagnostics };
  }
}

export const firecrawlWebsiteResearchProvider = new FirecrawlWebsiteResearchProvider();