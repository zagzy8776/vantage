import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { investigationAccess, investigationBusinesses, investigationSearchRuns, investigationShares, investigations } from "@/lib/db/schema";
import type { InvestigationStatus, InvestigationSummary } from "./types";
import type { AuthContext } from "@/auth/types";

export async function listScopedInvestigations(auth: AuthContext, params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: InvestigationStatus;
}): Promise<{ items: InvestigationSummary[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const search = params.search?.trim();

  const baseFilters = [
    params.status ? eq(investigations.status, params.status) : undefined,
    search ? or(
      ilike(investigations.title, `%${search}%`),
      ilike(investigations.industry, `%${search}%`),
      ilike(investigations.city, `%${search}%`),
      ilike(investigations.country, `%${search}%`),
    ) : undefined,
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));

  const accessFilter = or(
    eq(investigationAccess.ownerId, auth.userId),
    auth.organizationId ? eq(investigationAccess.organizationId, auth.organizationId) : undefined,
    eq(investigationShares.userId, auth.userId),
  );

  const rows = await getDb().selectDistinct({
    id: investigations.id,
    title: investigations.title,
    type: investigations.investigationType,
    status: investigations.status,
    industry: investigations.industry,
    country: investigations.country,
    city: investigations.city,
    objective: investigations.objective,
    createdAt: investigations.createdAt,
    updatedAt: investigations.updatedAt,
  }).from(investigations)
    .innerJoin(investigationAccess, eq(investigationAccess.investigationId, investigations.id))
    .leftJoin(investigationShares, eq(investigationShares.investigationAccessId, investigationAccess.id))
    .where(and(...baseFilters, accessFilter, sql`(${investigationAccess.ownerId} = ${auth.userId} OR ${investigationShares.userId} = ${auth.userId} AND ${investigationShares.permission} <> 'none' OR ${auth.organizationId ? sql`${investigationAccess.organizationId} = ${auth.organizationId}` : sql`false`})`))
    .orderBy(desc(investigations.createdAt));

  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const items = await Promise.all(pageRows.map(async (item) => {
    const [businessCountResult, searchRunCountResult] = await Promise.all([
      getDb().select({ count: count() }).from(investigationBusinesses).where(eq(investigationBusinesses.investigationId, item.id)),
      getDb().select({ count: count() }).from(investigationSearchRuns).where(eq(investigationSearchRuns.investigationId, item.id)),
    ]);
    return {
      ...item,
      businessCount: Number(businessCountResult[0]?.count ?? 0),
      searchRunCount: Number(searchRunCountResult[0]?.count ?? 0),
    } satisfies InvestigationSummary;
  }));

  return { items, total, page, pageSize };
}
