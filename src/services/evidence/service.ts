import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { evidenceItems } from "@/lib/db/schema";
import { createId } from "@/lib/ids";
import { researchWebsite } from "./collector";
import { detectEvidenceConflicts } from "./conflicts";
import { firecrawlWebsiteResearchProvider } from "@/providers/website-research/firecrawl";
import type { EvidenceConflict, EvidenceItem, WebsiteResearchResult } from "./types";

export async function storeEvidence(items: EvidenceItem[], options?: { runId?: string }) {
  if (!items.length) return;
  const db = getDb();
  const rows = items.map((item) => ({
    id: item.id ?? createId("ev"),
    businessId: item.businessId,
    category: item.category,
    statement: item.statement,
    value: item.value ?? null,
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl ?? null,
    confidence: item.confidence,
    observedAt: new Date(item.observedAt),
    metadata: item.metadata ?? null,
    searchRunId: options?.runId ?? null,
  }));
  await db.insert(evidenceItems).values(rows).onConflictDoNothing();
}

export async function getBusinessEvidence(businessId: string): Promise<EvidenceItem[]> {
  const rows = await getDb()
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.businessId, businessId))
    .orderBy(desc(evidenceItems.observedAt))
    .limit(200);
  return rows.map((row) => ({
    id: row.id,
    businessId: row.businessId,
    category: row.category as EvidenceItem["category"],
    statement: row.statement,
    value: row.value ?? undefined,
    sourceType: row.sourceType as EvidenceItem["sourceType"],
    sourceUrl: row.sourceUrl ?? undefined,
    confidence: row.confidence as EvidenceItem["confidence"],
    observedAt: row.observedAt.toISOString(),
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
  }));
}

export async function getBusinessEvidenceConflicts(businessId: string): Promise<EvidenceConflict[]> {
  const evidence = await getBusinessEvidence(businessId);
  return detectEvidenceConflicts(evidence);
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
  return result;
}
