import type { WebsiteVerificationContext, WebsiteVerificationResult } from "./types";

const BLOCKED_ROOT_DOMAINS = new Set([
  "yelp.com",
  "foursquare.com",
  "google.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "linkedin.com",
  "tripadvisor.com",
  "yellowpages.com",
  "yellowpages.ca",
  "bbb.org",
  "mapquest.com",
]);

function rootDomain(hostname: string) {
  const labels = hostname.toLowerCase().replace(/^www\./, "").split(".");
  return labels.length > 2 ? labels.slice(-2).join(".") : labels.join(".");
}

function tokens(value?: string) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 2);
}

export function isDirectoryOrSocialDomain(value: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return BLOCKED_ROOT_DOMAINS.has(rootDomain(url.hostname));
  } catch {
    return false;
  }
}

export function verifyOfficialWebsite(value: string | undefined | null, context: WebsiteVerificationContext = {}): WebsiteVerificationResult {
  const inputUrl = value?.trim() ?? "";
  if (!inputUrl) return { inputUrl, normalizedUrl: null, domain: null, officialWebsite: false, sourceReference: false, status: "uncertain", confidenceScore: 0, reasons: ["No website URL was supplied."] };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`);
  } catch {
    return { inputUrl, normalizedUrl: null, domain: null, officialWebsite: false, sourceReference: true, status: "rejected", confidenceScore: 0, reasons: ["URL is invalid."] };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return { inputUrl, normalizedUrl: null, domain: null, officialWebsite: false, sourceReference: true, status: "rejected", confidenceScore: 0, reasons: ["Only public HTTP(S) URLs can be considered."] };

  const domain = rootDomain(url.hostname);
  if (BLOCKED_ROOT_DOMAINS.has(domain)) return { inputUrl, normalizedUrl: url.toString(), domain, officialWebsite: false, sourceReference: true, status: "rejected", confidenceScore: 0, reasons: ["Directory, review, map, or social URLs are source references, not official websites."] };

  const domainText = domain.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
  const businessTokens = tokens(context.businessName);
  const cityTokens = tokens(context.city);
  const nameMatches = businessTokens.filter((token) => domainText.includes(token)).length;
  const cityMatches = cityTokens.filter((token) => domainText.includes(token)).length;
  const nameRatio = businessTokens.length ? nameMatches / businessTokens.length : 0;
  const score = Math.min(100, Math.round(nameRatio * 70 + (cityMatches ? 20 : 0) + 10));
  const reasons = ["The URL is on a public non-directory domain."];
  if (nameMatches) reasons.push("The domain contains business-name signals.");
  if (cityMatches) reasons.push("The domain contains location signals.");

  const status = score >= 75 ? "verified" : score >= 45 ? "likely" : "uncertain";
  return { inputUrl, normalizedUrl: url.toString(), domain, officialWebsite: status === "verified" || status === "likely", sourceReference: true, status, confidenceScore: score, reasons };
}