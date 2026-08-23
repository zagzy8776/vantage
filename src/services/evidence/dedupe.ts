import { strongerConfidence } from "./confidence";
import type { EvidenceItem } from "./types";

function keyPart(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ");
}

export function evidenceKey(item: EvidenceItem) {
  return [item.businessId, item.category, keyPart(item.statement), keyPart(item.value)].filter(Boolean).join("|");
}

export function dedupeEvidence(items: EvidenceItem[]): EvidenceItem[] {
  const byKey = new Map<string, EvidenceItem>();
  for (const item of items) {
    const key = evidenceKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item });
      continue;
    }
    byKey.set(key, {
      ...existing,
      confidence: strongerConfidence(existing.confidence, item.confidence),
      sourceUrl: existing.sourceUrl ?? item.sourceUrl,
      metadata: { ...existing.metadata, ...item.metadata },
    });
  }
  return Array.from(byKey.values());
}