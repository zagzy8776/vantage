import type { EvidenceCategory, EvidenceConflict, EvidenceConfidence, EvidenceItem } from "./types";

const CONFLICT_CATEGORIES: EvidenceCategory[] = ["business_identity", "business_category", "location", "contact", "website", "pricing", "opening_hours"];

export function evidenceFreshness(observedAt: string, now = new Date(), thresholds?: { agingDays?: number; staleDays?: number }) {
  const agingDays = thresholds?.agingDays ?? (Number(process.env.EVIDENCE_AGING_DAYS) || 30);
  const staleDays = thresholds?.staleDays ?? (Number(process.env.EVIDENCE_STALE_DAYS) || 180);
  const ageMs = Math.max(0, now.getTime() - new Date(observedAt).getTime());
  const ageDays = ageMs / 86_400_000;
  if (ageDays >= staleDays) return "stale" as const;
  if (ageDays >= agingDays) return "aging" as const;
  return "fresh" as const;
}

function normalized(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ");
}

export function evidenceFieldKey(item: EvidenceItem) {
  if (item.category === "contact") return "contact";
  if (item.category === "website") return "website";
  if (item.category === "opening_hours") return "opening_hours";
  if (item.category === "pricing") return "pricing";
  if (item.category === "location") return "location";
  if (item.category === "business_identity") return "business_identity";
  if (item.category === "business_category") return "business_category";
  return item.category;
}

export function findEvidenceConflicts(items: EvidenceItem[]): EvidenceConflict[] {
  const groups = new Map<string, EvidenceItem[]>();
  for (const item of items) {
    if (!CONFLICT_CATEGORIES.includes(item.category)) continue;
    const key = `${item.businessId}|${item.category}|${evidenceFieldKey(item)}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return Array.from(groups.entries()).flatMap(([key, group]) => {
    const values = new Set(group.map((item) => normalized(item.value ?? item.statement)).filter(Boolean));
    if (values.size < 2) return [];
    const [businessId, category, fieldKey] = key.split("|");
    return [{ businessId, category: category as EvidenceCategory, fieldKey, status: "requires-review", items: group, observedAt: new Date().toISOString() } satisfies EvidenceConflict];
  });
}

export function confidenceForSource(source: EvidenceItem["sourceType"], corroborated = false): EvidenceConfidence {
  if (corroborated) return "high";
  if (source === "foursquare" || source === "yelp" || source === "firecrawl" || source === "pagespeed") return "high";
  if (source === "tavily" || source === "exa" || source === "website" || source === "public_page") return "medium";
  return "low";
}