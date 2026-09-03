import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { assertDeepDiscoverySchemaReady } from "@/lib/db/migration-check";
import { businesses, evidenceConflicts, evidenceItems } from "@/lib/db/schema";
import { dedupeEvidence } from "./dedupe";
import { researchWebsite } from "./collector";
import { evidenceFreshness, findEvidenceConflicts } from "./conflicts";
import { firecrawlWebsiteResearchProvider } from "@/providers/website-research/firecrawl";
import { verificationStatusFromEvidence } from "./confidence";
import type { EvidenceItem, WebsiteResearchResult } from "./types";

function bestPublicPhone(items: EvidenceItem[]) {
  const candidates = items
    .filter((item) => item.category === "contact" && item.statement.startsWith("Public telephone number found:") && item.value)
    .map((item) => String(item.value).trim())
    .filter((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    });

  return candidates.sort((a, b) => {
    const aInternational = a.trim().startsWith("+") ? 1 : 0;
    const bInternational = b.trim().startsWith("+") ? 1 : 0;
    return bInternational - aInternational || b.replace(/\D/g, "").length - a.replace(/\D/g, "").length;
  })[0] ?? null;
}

async function persistRecoveredPhone(businessId: string, items: EvidenceItem[]) {
  const phone = bestPublicPhone(items);
  if (!phone) return;
  await getDb()
    .update(businesses)
    .set({ phone, updatedAt: new Date() })
    .where(eq(businesses.id, businessId));
}

export async function storeEvidence(items: EvidenceItem[], options?: { runId?: string }) {
  if (!items.length) return;
  await assertDeepDiscoverySchemaReady();
  const db = getDb();
  const normalized = dedupeEvidence(items);
  for (const item of normalized) {
    await db.insert(evidenceItems).values({
      id: item.id ?? `ev_${item.businessId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      businessId: item.businessId,
      runId: options?.runId ?? null,
      category: item.category,
      statement: item.statement,
      value: item.value ?? null,
      sourceType: item.sourceType,
      sourceUrl: item.sourceUrl ?? null,
      confidence: item.confidence,
      observedAt: new Date(item.observedAt),
      metadata: item.metadata ?? null,
    });
  }
  const conflicts = findEvidenceConflicts(normalized);
  for (const conflict of conflicts) {
    await db.insert(evidenceConflicts).values({
      id: `conf_${conflict.businessId}_${conflict.category}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      businessId: conflict.businessId,
      category: conflict.category,
      fieldKey: conflict.fieldKey,
      status: conflict.status,
      items: conflict.items,
      observedAt: new Date(conflict.observedAt),
    });
  }
}

export async function enrichBusinessWebsite(
  businessId: string,
  websiteUrl: string,
  limits?: { maxPages?: number; timeoutMs?: number; runId?: string },
): Promise<WebsiteResearchResult> {
  const result = await researchWebsite(businessId, websiteUrl, {
    maxPages: limits?.maxPages,
    timeoutMs: limits?.timeoutMs,
  });
  await storeEvidence(result.evidence, { runId: limits?.runId });
  await persistRecoveredPhone(businessId, result.evidence);
  await assertDeepDiscoverySchemaReady();
  await getDb()
    .update(businesses)
    .set({ verificationStatus: result.verificationStatus, updatedAt: new Date() })
    .where(eq(businesses.id, businessId));
  return result;
}

export async function enrichBusinessWebsiteWithFirecrawl(
  businessId: string,
  websiteUrl: string,
  maxPages = 10,
  runId?: string,
): Promise<WebsiteResearchResult> {
  const result = await firecrawlWebsiteResearchProvider.research({ businessId, url: websiteUrl, maxPages });
  await storeEvidence(result.evidence, { runId });
  await persistRecoveredPhone(businessId, result.evidence);
  await assertDeepDiscoverySchemaReady();
  const verificationStatus = verificationStatusFromEvidence(result.evidence);
  await getDb()
    .update(businesses)
    .set({ verificationStatus, updatedAt: new Date() })
    .where(eq(businesses.id, businessId));
  return {
    businessId,
    websiteUrl,
    pagesFetched: result.pagesFetched,
    evidence: result.evidence,
    verificationStatus,
    errors: result.errors,
  };
}

export async function getBusinessEvidence(businessId: string, limit = 100) {
  const rows = await getDb()
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.businessId, businessId))
    .orderBy(desc(evidenceItems.observedAt))
    .limit(limit);
  return rows;
}

export async function getBusinessEvidenceConflicts(businessId: string, limit = 50) {
  return getDb()
    .select()
    .from(evidenceConflicts)
    .where(eq(evidenceConflicts.businessId, businessId))
    .orderBy(desc(evidenceConflicts.observedAt))
    .limit(limit);
}

export { evidenceFreshness };
