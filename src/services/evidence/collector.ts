import { verificationStatusFromEvidence } from "./confidence";
import { dedupeEvidence } from "./dedupe";
import { normalizeEvidenceItem, normalizeEvidenceText } from "./normalizer";
import type { EvidenceItem, WebsiteResearchLimits, WebsiteResearchResult } from "./types";
import { DEFAULT_WEBSITE_RESEARCH_LIMITS } from "./types";
import { extractEmailsFromHtml } from "@/lib/outreach/emails";

interface LinkCandidate { href: string; label: string; }

const PAGE_KEYWORDS: Record<string, string[]> = {
  contact: ["contact", "get-in-touch", "reach-us", "location", "directions", "enquiry", "inquiry"],
  about: ["about", "story", "company", "our-team", "who-we-are"],
  booking: ["book", "booking", "appointment", "reserve", "reservation", "schedule", "book-now"],
  ecommerce: ["shop", "store", "cart", "checkout", "buy"],
  services: ["service", "offer", "solutions", "treatments", "what-we-do"],
  products: ["product", "collection", "menu", "catalog"],
  pricing: ["price", "pricing", "rates", "cost", "fees"],
  faq: ["faq", "frequently asked", "help"],
};

const PAGE_WEIGHT: Record<string, number> = {
  contact: 4,
  booking: 3,
  about: 3,
  ecommerce: 2,
  services: 2,
  products: 1,
  pricing: 2,
  faq: 1,
};

function decodeHtml(value: string) {
  return value
    .replace(/&/gi, "&")
    .replace(/"/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/</gi, "<")
    .replace(/>/gi, ">");
}

function isPublicHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1") return false;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false;
  const private172 = host.match(/^172\.(\d+)\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
  return true;
}

export function isPermittedPublicUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && isPublicHostname(url.hostname);
  } catch {
    return false;
  }
}

function robotsDisallows(robots: string, path: string) {
  let applies = false;
  for (const line of robots.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [rawKey, ...rawValue] = trimmed.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (key === "user-agent") applies = value === "*";
    if (applies && key === "disallow" && value && path.startsWith(value)) return true;
  }
  return false;
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function getTagContent(html: string, tag: string) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? normalizeEvidenceText(stripHtml(match[1])) : "";
}

function getMeta(html: string, name: string) {
  const match = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"));
  return match ? normalizeEvidenceText(decodeHtml(match[1])) : "";
}

function extractPhonesFromHtml(html: string) {
  const phones = new Set<string>();
  for (const match of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    const value = decodeHtml(match[1]).replace(/[?#].*$/, "").trim();
    if (value) phones.add(value);
  }
  const text = stripHtml(html);
  for (const match of text.matchAll(/(?:\+?\d[\d\s().-]{6,}\d)/g)) {
    const value = match[0].trim().replace(/\s+/g, " ");
    if (value) phones.add(value);
  }
  return Array.from(phones).slice(0, 5);
}

export function extractInternalLinks(html: string, pageUrl: string): LinkCandidate[] {
  const base = new URL(pageUrl);
  const links: LinkCandidate[] = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const rawHref = decodeHtml(match[1]).trim();
    if (!rawHref || /^(mailto:|tel:|javascript:|#)/i.test(rawHref)) continue;
    try {
      const url = new URL(rawHref, pageUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (url.hostname.toLowerCase() !== base.hostname.toLowerCase()) continue;
      url.hash = "";
      links.push({ href: url.toString(), label: normalizeEvidenceText(stripHtml(match[2])).toLowerCase() });
    } catch {
      /* Ignore malformed public links. */
    }
  }
  return Array.from(new Map(links.map((link) => [link.href, link])).values());
}

export function selectResearchLinks(links: LinkCandidate[], maxPages: number) {
  const ranked = links
    .map((link) => {
      const haystack = `${link.label} ${link.href}`.toLowerCase();
      let score = 0;
      for (const [bucket, words] of Object.entries(PAGE_KEYWORDS)) {
        const weight = PAGE_WEIGHT[bucket] ?? 1;
        if (words.some((word) => haystack.includes(word))) score += weight;
      }
      return { ...link, score };
    })
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, Math.max(0, maxPages - 1)).map(({ href }) => href);
}

function evidenceForSignals(
  businessId: string,
  pageUrl: string,
  html: string,
  sourceType: "website" | "public_page",
  observedAt: string,
) {
  const text = stripHtml(html);
  const normalizedText = text.toLowerCase();
  const items: EvidenceItem[] = [];
  const add = (
    category: EvidenceItem["category"],
    statement: string,
    value?: string,
    explicit = true,
    metadata?: Record<string, unknown>,
  ) => {
    const item = normalizeEvidenceItem({
      businessId,
      category,
      statement,
      value,
      sourceType,
      sourceUrl: pageUrl,
      explicit,
      observedAt,
      metadata,
    });
    if (item) items.push(item);
  };

  const title = getTagContent(html, "title");
  const description = getMeta(html, "description");
  if (title) add("business_identity", `Public page title: ${title}`, title);
  if (description) add("about", `Public page description: ${description}`, description);
  if (/<form\b/i.test(html) || /contact|inquiry|message us/i.test(normalizedText))
    add("contact", "A public contact form or contact language is present on the page.");

  const phones = extractPhonesFromHtml(html);
  for (const phone of phones) {
    add("contact", `Public telephone number found: ${phone}`, phone, true, { phone });
  }

  const emails = extractEmailsFromHtml(html);
  for (const email of emails.slice(0, 5)) {
    add("contact", `Public email address found: ${email}`, email, true, { email });
  }

  if (/(booking|book now|appointment|reserve|reservation|schedule)/i.test(normalizedText))
    add("booking", "A public booking, appointment, reservation, or scheduling signal is present on the page.");
  if (/(cart|checkout|add to cart|shop now|buy now|product[s]?|\$\s?\d+|€\s?\d+|£\s?\d+)/i.test(normalizedText))
    add("ecommerce", "Public shopping, checkout, product, or price signals are present on the page.");
  if (/(service[s]?|menu|what we offer|solutions|treatments)/i.test(normalizedText))
    add("services", "A public services or offering signal is present on the page.");
  if (/(opening hours|business hours|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(normalizedText))
    add("opening_hours", "Public opening-hours language appears on the page.");
  const socials = Array.from(
    html.matchAll(/https?:\/\/(?:www\.)?(instagram|facebook|tiktok|linkedin)\.com[^"'\s<]*/gi),
  ).map((match) => match[0]);
  if (socials.length)
    add(
      "social_presence",
      `Public social profile links were found: ${Array.from(
        new Set(socials.map((url) => new URL(url).hostname.replace(/^www\./, ""))),
      ).join(", ")}.`,
      socials.join(", "),
      true,
      { profiles: socials },
    );
  if (/(shopify|woocommerce|magento|wordpress|wix|squarespace|webflow)/i.test(normalizedText))
    add("technology", "A public technology/platform signal appears in the page content.");
  return items;
}

export function detectBookingSignals(html: string) {
  return /(booking|book now|appointment|reserve|reservation|schedule)/i.test(stripHtml(html));
}
export function detectEcommerceSignals(html: string) {
  return /(cart|checkout|add to cart|shop now|buy now|product[s]?|\$\s?\d+|€\s?\d+|£\s?\d+|\/shop\b|\/store\b)/i.test(
    `${html} ${stripHtml(html)}`,
  );
}
export function detectContactSignals(html: string) {
  return /<form\b|contact|inquiry|mailto:|tel:|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(html);
}
export function detectSocialLinks(html: string) {
  return Array.from(
    new Set(
      Array.from(
        html.matchAll(/https?:\/\/(?:www\.)?(?:instagram|facebook|tiktok|linkedin)\.com[^"'\s<]*/gi),
      ).map((match) => match[0]),
    ),
  );
}

async function fetchPublicPage(url: string, limits: WebsiteResearchLimits) {
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(limits.timeoutMs),
  });
  if (!response.ok) throw new Error(`Public page returned ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml"))
    throw new Error("Public page is not HTML.");
  return (await response.text()).slice(0, limits.maxBodyCharacters);
}

export async function researchWebsite(
  businessId: string,
  websiteUrl: string,
  limits: Partial<WebsiteResearchLimits> = {},
): Promise<WebsiteResearchResult> {
  const resolved = { ...DEFAULT_WEBSITE_RESEARCH_LIMITS, ...limits };
  const normalizedUrl = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
  const pagesFetched: string[] = [];
  const errors: string[] = [];
  const evidence: EvidenceItem[] = [];
  const observedAt = new Date().toISOString();
  let homepage = "";
  if (!isPermittedPublicUrl(normalizedUrl))
    return {
      businessId,
      websiteUrl: normalizedUrl,
      pagesFetched,
      evidence,
      verificationStatus: "uncertain",
      errors: ["Website URL is not a permitted public HTTP(S) URL."],
    };
  try {
    const homepageUrl = new URL(normalizedUrl);
    try {
      const robotsResponse = await fetch(new URL("/robots.txt", homepageUrl).toString(), {
        headers: { Accept: "text/plain" },
        cache: "no-store",
        signal: AbortSignal.timeout(resolved.timeoutMs),
      });
      if (robotsResponse.ok && robotsDisallows(await robotsResponse.text(), homepageUrl.pathname))
        return {
          businessId,
          websiteUrl: normalizedUrl,
          pagesFetched,
          evidence,
          verificationStatus: "uncertain",
          errors: ["Website robots.txt disallows the homepage path."],
        };
    } catch {
      /* robots failure does not grant permission to bypass other controls */
    }
    homepage = await fetchPublicPage(normalizedUrl, resolved);
    pagesFetched.push(normalizedUrl);
    evidence.push(...evidenceForSignals(businessId, normalizedUrl, homepage, "website", observedAt));
    evidence.push(
      normalizeEvidenceItem({
        businessId,
        category: "website",
        statement: "A public website responded with permitted HTML content.",
        value: normalizedUrl,
        sourceType: "website",
        sourceUrl: normalizedUrl,
        explicit: true,
        observedAt,
      })!,
    );

    // Multi-hop: homepage → high-value pages → more contact links from those pages.
    const seen = new Set<string>([normalizedUrl]);
    const queue: string[] = selectResearchLinks(extractInternalLinks(homepage, normalizedUrl), resolved.maxPages);
    while (queue.length > 0 && pagesFetched.length < resolved.maxPages) {
      const url = queue.shift()!;
      if (seen.has(url)) continue;
      seen.add(url);
      try {
        const html = await fetchPublicPage(url, resolved);
        pagesFetched.push(url);
        evidence.push(...evidenceForSignals(businessId, url, html, "public_page", observedAt));
        if (pagesFetched.length < resolved.maxPages) {
          for (const next of selectResearchLinks(extractInternalLinks(html, url), 6)) {
            if (!seen.has(next) && !queue.includes(next)) queue.push(next);
          }
        }
      } catch (error) {
        errors.push(`${url}: ${error instanceof Error ? error.message : "Page fetch failed."}`);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Website research failed.");
  }
  const deduped = dedupeEvidence(evidence.filter(Boolean));
  return {
    businessId,
    websiteUrl: normalizedUrl,
    pagesFetched,
    evidence: deduped,
    verificationStatus: verificationStatusFromEvidence(deduped),
    errors,
  };
}
