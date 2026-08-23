import type { EvidenceSearchResultItem } from "./types";
import type { NormalizedBusiness } from "@/providers/business/types";
import { isDirectoryOrSocialDomain } from "@/services/website-verification/verify";

function domainOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./i, "").toLowerCase(); } catch { return undefined; }
}

function businessNameFromTitle(title: string) {
  return title.split(/[|–—-]/)[0]?.trim().replace(/\s+/g, " ") || title.trim();
}

export function extractWebCandidate(result: EvidenceSearchResultItem, input: { country?: string; city?: string; category?: string }): NormalizedBusiness | null {
  if (!result.title || !result.url) return null;
  const domain = domainOf(result.url);
  if (!domain) return null;
  const name = businessNameFromTitle(result.title);
  if (!name) return null;
  return {
    externalId: `web_${domain}`,
    source: "web",
    name,
    category: input.category,
    country: input.country,
    city: input.city,
    website: isDirectoryOrSocialDomain(result.url) ? undefined : result.url,
  };
}

export function extractWebCandidates(results: EvidenceSearchResultItem[], input: { country?: string; city?: string; category?: string }, limit: number) {
  return Array.from(new Map(results.map((result) => extractWebCandidate(result, input)).filter((candidate): candidate is NormalizedBusiness => Boolean(candidate)).map((candidate) => [candidate.externalId, candidate])).values()).slice(0, limit);
}