import type { NormalizedBusiness } from "./types";

function trim(value?: string | null) {
  const next = value?.trim();
  return next ? next : undefined;
}

export function normalizePhone(phone?: string | null): string | undefined {
  const digits = phone?.replace(/\D+/g, "");
  return digits && digits.length >= 7 ? digits : undefined;
}

export function normalizeDomain(website?: string | null): string | undefined {
  if (!website) return undefined;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return undefined;
  }
}

export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|and|of|inc|llc|ltd|limited|company|co|corp|corporation|restaurant|cafe|shop|store)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function businessKeyParts(business: NormalizedBusiness) {
  return {
    name: normalizeBusinessName(business.name),
    phone: normalizePhone(business.phone),
    website: normalizeDomain(business.website),
    address: [trim(business.address), trim(business.street), trim(business.area), trim(business.city), trim(business.region), trim(business.country)]
      .filter(Boolean)
      .join(" | ")
      .toLowerCase(),
    city: trim(business.city)?.toLowerCase(),
    country: trim(business.country)?.toLowerCase(),
    latitude: business.latitude,
    longitude: business.longitude,
  };
}

export function estimateBusinessEvidenceScore(business: NormalizedBusiness): number {
  let score = 0;
  if (business.website) score += 3;
  if (business.phone) score += 3;
  if (business.rating !== undefined) score += 2;
  if (business.reviewCount !== undefined) score += 2;
  if (business.address) score += 1;
  if (business.latitude !== undefined && business.longitude !== undefined) score += 3;
  return score;
}
