import type { EvidenceConfidence, EvidenceItem } from "./types";

const RANK: Record<EvidenceConfidence, number> = { low: 1, medium: 2, high: 3 };

export function confidenceFromEvidence(input: { sourceType: EvidenceItem["sourceType"]; explicit: boolean; corroborated?: boolean; ambiguous?: boolean }): EvidenceConfidence {
  if (input.ambiguous) return "low";
  if (input.corroborated && input.explicit) return "high";
  if (input.explicit && (input.sourceType === "website" || input.sourceType === "public_page" || input.sourceType === "foursquare" || input.sourceType === "yelp")) return "high";
  if (input.explicit) return "medium";
  return "low";
}

export function strongerConfidence(left: EvidenceConfidence, right: EvidenceConfidence): EvidenceConfidence {
  return RANK[left] >= RANK[right] ? left : right;
}

export function verificationStatusFromEvidence(items: EvidenceItem[]): "verified" | "likely" | "uncertain" {
  const identity = items.filter((item) => item.category === "business_identity");
  const hasWebsite = items.some((item) => item.category === "website" && item.confidence === "high");
  const hasLocation = items.some((item) => item.category === "location" && item.confidence !== "low");
  const highIdentity = identity.some((item) => item.confidence === "high");
  if (highIdentity && hasWebsite && hasLocation) return "verified";
  if (highIdentity || hasWebsite || hasLocation) return "likely";
  return "uncertain";
}