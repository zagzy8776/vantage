import type { NormalizedBusiness } from "@/providers/business/types";

export function calculateInitialOpportunityScore(business: NormalizedBusiness): { score: number; reason: string; websiteStatus: "none" | "unknown" } {
  let score = 35;
  const reasonParts: string[] = [];

  if (business.website) {
    score += 20;
    reasonParts.push("Website detected");
  } else {
    score += 25;
    reasonParts.push("No website found");
  }

  if (business.rating !== undefined) {
    if (business.rating >= 4.5) score += 10;
    else if (business.rating >= 4) score += 7;
    else if (business.rating >= 3.5) score += 4;
    else score += 1;
  }

  if (typeof business.reviewCount === "number") {
    if (business.reviewCount >= 100) score += 10;
    else if (business.reviewCount >= 25) score += 6;
    else if (business.reviewCount > 0) score += 3;
  }

  if (business.category) {
    score += 4;
    reasonParts.push(`Category: ${business.category}`);
  }

  if (business.city || business.country) {
    score += 4;
    reasonParts.push([business.city, business.country].filter(Boolean).join(", "));
  }

  if (!business.phone) {
    score += 2;
  }

  score = Math.max(0, Math.min(100, score));

  const websiteStatus = business.website ? "unknown" : "none";

  return {
    score,
    reason: reasonParts.length ? reasonParts.join(" • ") : "Initial discovery score calculated from provider data.",
    websiteStatus,
  };
}