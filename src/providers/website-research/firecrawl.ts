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

function extractPublicPhones(value: string) {
  const phones = new Set<string>();
  const add = (raw: string) => {
    const decoded = raw
      .replace(/&nbsp;/gi, " ")
      .replace(/&#43;/gi, "+")
      .replace(/&plus;/gi, "+")
      .replace(/\s+/g, " ")
      .trim();
    const cleaned = decoded.replace(/[?#].*$/, "").trim();
    if (!cleaned) return;
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) phones.add(cleaned);
  };

  for (const match of value.matchAll(/(?:href\s*=\s*["']tel:|tel:)([^"'\s<>]+)/gi)) add(match[1]);
  for (const match of value.matchAll(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\+?\d{7,15})/gi)) add(match[1]);
  for (const match of value.matchAll(/(?:telephone|phone|tel)\s*["']?\s*[:=]\s*["']([^"'}<]{7,40})["']/gi)) add(match[1]);
  for (const match of value.matchAll(/(?:\+\d{1,3}[\s().-]?)?(?:\d[\s().-]?){7,14}\d/g)) add(match[0]);

  return Array.from(phones).filter((phone) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return false;
    if (/^\d{4}[\s-]?\d{1,2}[\s-]?\d{1,2}$/.test(phone)) return false;
    return true;
  }).slice(0, 5);
}

function extractPublicEmails(value: string) {
  return Array.from(new Set(
    value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [],
  )).slice(0, 5);
}

function textSignals(businessId: string, url: string, markdown: string, html: string, observedAt: string): EvidenceItem[] {
  const source = `${markdown}\n${html}`;
  const text = normalizeEvidenceText(markdown || html);
  const lower = text.toLowerCase();
  const result: EvidenceItem[] = [];
  const add = (category: EvidenceItem["category"], statement: string, value?: string, metadata?: Record<string, unknown>) => {
    const item = normalizeEvidenceItem({ businessId, category, statement, value, sourceType: "firecrawl", sourceUrl: url, explicit: true, observedAt, metadata });
    if (item) result.push(item);
  };
  if (text) add("content_signal", "Firecrawl extracted public page content for evidence analysis.", text.slice(0, 600));

  for (const phone of extractPublicPhones(source)) {
    add("contact", `Public telephone number found: ${phone}`, phone, { phone, extraction: "firecrawl-public-content" });
  }
  for (const email of extractPublicEmails(source)) {
    add("contact", `Public email address found: ${email}`, email, { email, extraction: "firecrawl-public-content" });
  }

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
            timeout: Number(process.env.FIRECRAWL_TIMEOUT_MS) || 60_000,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(Number(process.env.FIRECRAWL_TIMEOUT_MS) || 60_000),
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
      evidence.push(...textSignals(request.businessId, request.url, homepage.markdown ?? "", homepage.html ?? "", observedAt));
      const links = homepage.html ? selectResearchLinks(extractInternalLinks(homepage.html, request.url), maxPages) : [];
      for (const url of links) {
        if (pagesFetched.length >= maxPages) break;
        try {
          const page = await scrape(url);
          pagesFetched.push(url);
          evidence.push(...textSignals(request.businessId, url, page.markdown ?? "", page.html ?? "", observedAt));
        } catch (error) { errors.push(`${url}: ${error instanceof Error ? error.message : "Firecrawl page failed."}`); }
      }
    } catch (error) { errors.push(error instanceof Error ? error.message : "Firecrawl research failed."); }
    return { provider: this.name, pagesFetched, evidence: dedupeEvidence(evidence), errors, diagnostics };
  }
}

export const firecrawlWebsiteResearchProvider = new FirecrawlWebsiteResearchProvider();
