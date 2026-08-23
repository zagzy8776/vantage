import { confidenceFromEvidence } from "./confidence";
import type { EvidenceCategory, EvidenceItem, EvidenceSourceType } from "./types";

export function normalizeEvidenceText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 800);
}

export function normalizeEvidenceItem(input: Omit<EvidenceItem, "statement" | "confidence" | "observedAt"> & { statement: string; explicit?: boolean; corroborated?: boolean; ambiguous?: boolean; observedAt?: string }): EvidenceItem | null {
  const statement = normalizeEvidenceText(input.statement);
  if (!statement || !input.businessId || !input.category || !input.sourceType) return null;
  return {
    id: input.id,
    businessId: input.businessId,
    category: input.category,
    statement,
    value: input.value ? normalizeEvidenceText(input.value) : undefined,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    confidence: confidenceFromEvidence({ sourceType: input.sourceType, explicit: input.explicit ?? true, corroborated: input.corroborated, ambiguous: input.ambiguous }),
    observedAt: input.observedAt ?? new Date().toISOString(),
    metadata: input.metadata,
  };
}

export function sourceLabel(sourceType: EvidenceSourceType) {
  return sourceType === "public_page" ? "Public page" : sourceType.charAt(0).toUpperCase() + sourceType.slice(1);
}

export const EVIDENCE_CATEGORIES: EvidenceCategory[] = ["business_identity", "business_category", "location", "contact", "website", "services", "products", "pricing", "booking", "ecommerce", "social_presence", "opening_hours", "about", "technology", "customer_signal", "brand_signal", "content_signal"];