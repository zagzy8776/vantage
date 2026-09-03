import type { NormalizedBusiness } from "@/providers/business/types";

// Contact extraction is intentionally ES2015-compatible: Next's TypeScript target
// does not guarantee downlevel iteration for RegExpStringIterator.
function extractMatches(text: string, pattern: RegExp): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match);
    if (!pattern.global) break;
  }
  return matches;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function normalizeEvidenceText(value: string) {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
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
  for (const match of extractMatches(html, /href=["']tel:([^"']+)["']/gi)) {
    const value = decodeHtml(match[1]).replace(/[?#].*$/, "").trim();
    if (value) phones.add(value);
  }
  const text = stripHtml(html);
  for (const match of extractMatches(text, /(?:\+?\d[\d\s().-]{6,}\d)/g)) {
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
    } catch { /* Ignore malformed links. */ }
  }
  return links;
}

export interface LinkCandidate { href: string; label: string }

export function collectContactEvidence(html: string, pageUrl: string) {
  const emails = new Set<string>();
  for (const match of extractMatches(html, /mailto:([^"'\s?]+)/gi)) {
    const email = decodeHtml(match[1]).trim().toLowerCase();
    if (email.includes("@")) emails.add(email);
  }
  for (const match of extractMatches(stripHtml(html), /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    emails.add(match[0].trim().toLowerCase());
  }

  const phones = extractPhonesFromHtml(html);
  const links = extractInternalLinks(html, pageUrl);
  const title = getTagContent(html, "title");
  const description = getMeta(html, "description");

  return {
    emails: Array.from(emails).slice(0, 10),
    phones,
    links,
    title,
    description,
  };
}

export function extractContactSignals(html: string, pageUrl: string) {
  return collectContactEvidence(html, pageUrl);
}

export function normalizeBusinessContact(business: NormalizedBusiness) {
  return {
    phone: business.phone?.trim() || null,
    website: business.website?.trim() || null,
  };
}
