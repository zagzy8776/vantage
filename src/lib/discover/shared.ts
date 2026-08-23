import type { Lead } from "@/lib/types";
import type { NormalizedBusiness } from "@/providers/business/types";
import { normalizeCountry } from "@/lib/geography";

export function normalizedBusinessToLeadPreview(
  business: NormalizedBusiness,
  id: string,
  opportunityScore: number,
  websiteStatus: Lead["websiteHealth"],
  reason: string,
  sources?: Lead["business"]["sources"]
): Lead {
  return {
    id,
    business: {
      id,
      name: business.name,
      category: business.category ?? "Uncategorized",
      location: {
        country: business.country ?? "Unknown",
        countryCode: business.countryCode ?? normalizeCountry(business.country)?.countryCode ?? "UN",
        region: business.region,
        city: business.city ?? "Unknown",
        area: business.area,
        street: business.street,
      },
      website: business.website ?? null,
      phone: business.phone ?? null,
      source: business.source,
      sources: sources ?? [business.source],
      discoveredAt: new Date().toISOString(),
    },
    opportunityScore,
    websiteHealth: websiteStatus,
    status: "discovered",
    lastAnalyzedAt: null,
    reason,
    website: null,
  };
}