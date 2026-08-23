import { getDb } from "@/lib/db";
import { eq, desc, count, and, inArray, ilike, or } from "drizzle-orm";
import {
  investigations,
  investigationSearchRuns,
  investigationBusinesses,
  investigationSources,
  investigationClaims,
  investigationFindings,
  investigationOpportunities,
  investigationActions,
  investigationNotes,
  investigationSyntheses,
  investigationOpportunitySyntheses,
  investigationMarketSyntheses,
  investigationMarketPatterns,
  investigationMarketOpportunities,
  evidenceItems,
} from "@/lib/db/schema";
import {
  searchRuns as searchRunsTable,
  businesses as businessesTable,
  evidenceItems as evidenceItemsTable,
  evidenceConflicts as evidenceConflictsTable,
  aiAnalyses as aiAnalysesTable,
  leads as leadsTable,
} from "@/lib/db/schema";
import type {
  Investigation,
  InvestigationSearchRun,
  InvestigationBusiness,
  InvestigationSource,
  InvestigationClaim,
  InvestigationFinding,
  InvestigationOpportunity,
  InvestigationAction,
  InvestigationNote,
  InvestigationSummary,
  InvestigationDetail,
  CreateInvestigationInput,
  CreateStandaloneInvestigationInput,
  CreateInvestigationResult,
  CreateStandaloneInvestigationResult,
  InvestigationListParams,
  InvestigationSearchRunRole,
  InvestigationBusinessSummary,
  InvestigationEvidenceItem,
  InvestigationSourceConflict,
  InvestigationAiConflict,
  InvestigationRunSummary,
  InvestigationMetrics,
  InvestigationSynthesisStatus,
  InvestigationSynthesisValidationStatus,
  InvestigationMarketSynthesisHistory,
  InvestigationMarketPattern,
  InvestigationMarketOpportunity,
  InvestigationOpportunitySynthesisHistory,
} from "./types";
import type { InvestigationObjectiveSnapshot } from "./planning/types";
import { validateSearchRunForInvestigation, validateCreateInvestigationInput, validateEvidenceIds, validateStandaloneInvestigationInput } from "./validation";
import { newId } from "@/lib/ids";
import { createInvestigationPlan } from "./planning/planner";

function mapInvestigationRow(row: typeof investigations.$inferSelect): Investigation {
  return {
    id: row.id,
    title: row.title,
    objective: row.objective,
    investigationType: row.investigationType,
    status: row.status,
    industry: row.industry,
    country: row.country,
    region: row.region,
    city: row.city,
    criteria: row.criteria,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapInvestigationSearchRunRow(row: typeof investigationSearchRuns.$inferSelect): InvestigationSearchRun {
  return {
    investigationId: row.investigationId,
    searchRunId: row.searchRunId,
    role: row.role,
    createdAt: row.createdAt,
  };
}

function mapInvestigationBusinessRow(row: typeof investigationBusinesses.$inferSelect): InvestigationBusiness {
  return {
    investigationId: row.investigationId,
    businessId: row.businessId,
    role: row.role,
    includedReason: row.includedReason,
    createdAt: row.createdAt,
  };
}

function mapInvestigationSourceRow(row: typeof investigationSources.$inferSelect): InvestigationSource {
  return {
    id: row.id,
    investigationId: row.investigationId,
    searchRunId: row.searchRunId,
    provider: row.provider,
    sourceUrl: row.sourceUrl,
    sourceType: row.sourceType,
    createdAt: row.createdAt,
  };
}

function mapInvestigationClaimRow(row: typeof investigationClaims.$inferSelect): InvestigationClaim {
  return {
    id: row.id,
    investigationId: row.investigationId,
    businessId: row.businessId,
    claimType: row.claimType,
    statement: row.statement,
    confidence: row.confidence,
    evidenceIds: row.evidenceIds ?? [],
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapInvestigationFindingRow(row: typeof investigationFindings.$inferSelect): InvestigationFinding {
  return {
    id: row.id,
    investigationId: row.investigationId,
    title: row.title,
    summary: row.summary,
    findingType: row.findingType,
    confidence: row.confidence,
    businessIds: row.businessIds ?? [],
    evidenceIds: row.evidenceIds ?? [],
    claimIds: row.claimIds ?? [],
    status: row.status,
    unknowns: row.unknowns ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapInvestigationOpportunityRow(row: typeof investigationOpportunities.$inferSelect): InvestigationOpportunity {
  return {
    id: row.id,
    investigationId: row.investigationId,
    title: row.title,
    statement: row.statement,
    confidence: row.confidence,
    businessIds: row.businessIds ?? [],
    evidenceIds: row.evidenceIds ?? [],
    riskSummary: row.riskSummary,
    status: row.status,
    economicHypothesis: (row.economicHypothesis as InvestigationOpportunity["economicHypothesis"]) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapInvestigationActionRow(row: typeof investigationActions.$inferSelect): InvestigationAction {
  return {
    id: row.id,
    investigationId: row.investigationId,
    title: row.title,
    description: row.description,
    priority: row.priority,
    actionType: row.actionType,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapInvestigationNoteRow(row: typeof investigationNotes.$inferSelect): InvestigationNote {
  return {
    id: row.id,
    investigationId: row.investigationId,
    author: row.author,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createInvestigation(input: CreateInvestigationInput): Promise<CreateInvestigationResult> {
  const validation = validateCreateInvestigationInput(input);
  if (!validation.ok || !validation.data) {
    throw new Error(validation.error ?? "Invalid investigation input.");
  }
  const { title, objective, investigationType, searchRunId, criteria } = validation.data;
  const typedInvestigationType = investigationType as "company" | "industry" | "market" | "problem" | "service_opportunity";

  let industry: string | null = null;
  let country: string | null = null;
  let city: string | null = null;
  let region: string | null = null;

  if (searchRunId) {
    const eligibility = await validateSearchRunForInvestigation(searchRunId);
    if (eligibility === "not_found") throw new Error("Search run not found.");
    if (eligibility === "not_terminal") throw new Error("Search run is not in a terminal state. Only completed or completed_with_errors runs can be used.");

    const run = await getDb().select().from(searchRunsTable).where(eq(searchRunsTable.id, searchRunId)).limit(1);
    const runRow = run[0];

    industry = runRow.query;
    country = runRow.country;
    region = null;
    city = runRow.city;
  }

  const investigationId = newId();
  const now = new Date();

  await getDb().insert(investigations).values({
    id: investigationId,
    title,
    objective,
    investigationType: typedInvestigationType,
    status: "draft",
    industry,
    country,
    region,
    city,
    criteria: criteria ? { ...criteria, ...(searchRunId ? { query: industry, depth: "standard", country, city } : {}) } : (searchRunId ? { query: industry, depth: "standard", country, city } : null),
    createdAt: now,
    updatedAt: now,
  });

  if (searchRunId) {
    await attachSearchRun(investigationId, searchRunId, "initial_discovery");
    await attachBusinessesFromSearchRun(investigationId, searchRunId);
    await attachSourcesFromSearchRun(investigationId, searchRunId);
  }

  return { investigationId };
}

export async function createStandaloneInvestigation(input: CreateStandaloneInvestigationInput): Promise<CreateStandaloneInvestigationResult> {
  const validation = validateStandaloneInvestigationInput(input);
  if (!validation.ok || !validation.data) {
    throw new Error(validation.error ?? "Invalid standalone investigation input.");
  }
  const { title, objective, investigationType, industry, geography, problemCategory, serviceCategory, researchQuestion, criteria } = validation.data;
  const typedInvestigationType = investigationType as "company" | "industry" | "market" | "problem" | "service_opportunity";

  const investigationId = newId();
  const now = new Date();

  // Create the investigation
  await getDb().insert(investigations).values({
    id: investigationId,
    title,
    objective,
    investigationType: typedInvestigationType,
    status: "draft",
    industry: industry ?? null,
    country: geography.country,
    region: geography.region ?? null,
    city: geography.city ?? null,
    criteria: {
      ...criteria,
      problemCategory,
      serviceCategory,
      researchQuestion,
      geography,
    },
    createdAt: now,
    updatedAt: now,
  });

  // Generate a draft research plan
  const objectiveSnapshot: InvestigationObjectiveSnapshot = {
    investigationType: typedInvestigationType,
    objective,
    problemCategory,
    serviceCategory,
    targetIndustry: industry,
    geography,
    criteria,
  };
  const planResult = await createInvestigationPlan(investigationId, {
    objectiveSnapshot,
  });

  return {
    investigationId,
    planId: planResult.planId,
    planVersion: planResult.version,
  };
}

export async function attachSearchRun(investigationId: string, searchRunId: string, role: InvestigationSearchRunRole = "initial_discovery"): Promise<void> {
  const existing = await getDb().select().from(investigationSearchRuns).where(and(eq(investigationSearchRuns.investigationId, investigationId), eq(investigationSearchRuns.searchRunId, searchRunId))).limit(1);
  if (existing.length > 0) return;

  await getDb().insert(investigationSearchRuns).values({
    investigationId,
    searchRunId,
    role,
    createdAt: new Date(),
  });

  await getDb().update(investigations).set({ updatedAt: new Date() }).where(eq(investigations.id, investigationId));
}

export async function attachBusinessesFromSearchRun(investigationId: string, searchRunId: string): Promise<number> {
  const evidenceBusinesses = await getDb()
    .select({ businessId: evidenceItems.businessId })
    .from(evidenceItems)
    .where(eq(evidenceItems.runId, searchRunId))
    .groupBy(evidenceItems.businessId);

  let attached = 0;
  for (const { businessId } of evidenceBusinesses) {
    const existing = await getDb().select().from(investigationBusinesses).where(and(eq(investigationBusinesses.investigationId, investigationId), eq(investigationBusinesses.businessId, businessId))).limit(1);
    if (existing.length === 0) {
      await getDb().insert(investigationBusinesses).values({
        investigationId,
        businessId,
        role: "primary",
        includedReason: `Discovered in search run ${searchRunId}`,
        createdAt: new Date(),
      });
      attached++;
    }
  }
  await getDb().update(investigations).set({ updatedAt: new Date() }).where(eq(investigations.id, investigationId));
  return attached;
}

export async function attachSourcesFromSearchRun(investigationId: string, searchRunId: string): Promise<number> {
  const sources = await getDb()
    .select({
      id: evidenceItems.id,
      provider: evidenceItems.sourceType,
      sourceUrl: evidenceItems.sourceUrl,
      sourceType: evidenceItems.sourceType,
    })
    .from(evidenceItems)
    .where(eq(evidenceItems.runId, searchRunId));

  let attached = 0;
  for (const source of sources) {
    const sourceId = newId();
    await getDb().insert(investigationSources).values({
      id: sourceId,
      investigationId,
      searchRunId,
      provider: source.provider,
      sourceUrl: source.sourceUrl,
      sourceType: source.sourceType,
      createdAt: new Date(),
    });
    attached++;
  }
  await getDb().update(investigations).set({ updatedAt: new Date() }).where(eq(investigations.id, investigationId));
  return attached;
}

export async function listInvestigations(params: InvestigationListParams = {}): Promise<{ items: InvestigationSummary[]; total: number; page: number; pageSize: number }> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const filters = [
    params.status ? eq(investigations.status, params.status) : undefined,
    params.search?.trim()
      ? or(
          ilike(investigations.title, `%${params.search.trim()}%`),
          ilike(investigations.industry, `%${params.search.trim()}%`),
          ilike(investigations.city, `%${params.search.trim()}%`),
          ilike(investigations.country, `%${params.search.trim()}%`),
        )
      : undefined,
  ].filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const items = await getDb()
    .select({
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
    })
    .from(investigations)
    .where(where)
    .orderBy(desc(investigations.createdAt))
    .limit(pageSize)
    .offset(offset);

  const totalResult = await getDb().select({ count: count() }).from(investigations).where(where);
  const total = Number(totalResult[0]?.count ?? 0);

  const summaries: InvestigationSummary[] = await Promise.all(
    items.map(async (item) => {
      const businessCountResult = await getDb().select({ count: count() }).from(investigationBusinesses).where(eq(investigationBusinesses.investigationId, item.id));
      const searchRunCountResult = await getDb().select({ count: count() }).from(investigationSearchRuns).where(eq(investigationSearchRuns.investigationId, item.id));
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        industry: item.industry,
        country: item.country,
        city: item.city,
        objective: item.objective,
        businessCount: Number(businessCountResult[0]?.count ?? 0),
        searchRunCount: Number(searchRunCountResult[0]?.count ?? 0),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    })
  );

  return { items: summaries, total, page, pageSize };
}

export async function getInvestigationDetail(investigationId: string, options: { includeEvidence?: boolean } = {}): Promise<InvestigationDetail | null> {
  const includeEvidence = options.includeEvidence ?? true;
  const investigationRow = await getDb().select().from(investigations).where(eq(investigations.id, investigationId)).limit(1);
  if (!investigationRow[0]) return null;

  const investigation = mapInvestigationRow(investigationRow[0]);

  const [searchRunsRows, businessRows, sourceRows, claimRows, findingRows, opportunityRows, actionRows, noteRows] = await Promise.all([
    getDb().select().from(investigationSearchRuns).where(eq(investigationSearchRuns.investigationId, investigationId)),
    getDb().select().from(investigationBusinesses).where(eq(investigationBusinesses.investigationId, investigationId)),
    getDb().select().from(investigationSources).where(eq(investigationSources.investigationId, investigationId)),
    getDb().select().from(investigationClaims).where(eq(investigationClaims.investigationId, investigationId)),
    getDb().select().from(investigationFindings).where(eq(investigationFindings.investigationId, investigationId)),
    getDb().select().from(investigationOpportunities).where(eq(investigationOpportunities.investigationId, investigationId)),
    getDb().select().from(investigationActions).where(eq(investigationActions.investigationId, investigationId)),
    getDb().select().from(investigationNotes).where(eq(investigationNotes.investigationId, investigationId)),
  ]);

  const businesses = businessRows.map(mapInvestigationBusinessRow);
  const searchRuns = searchRunsRows.map(mapInvestigationSearchRunRow);

  const runIds = searchRuns.map((run) => run.searchRunId);
  const businessIds = businesses.map((business) => business.businessId);

  const runRowsById = new Map<string, typeof searchRunsTable.$inferSelect>();
  if (runIds.length > 0) {
    const runRows = await getDb().select({
      id: searchRunsTable.id,
      query: searchRunsTable.query,
      country: searchRunsTable.country,
      city: searchRunsTable.city,
      depth: searchRunsTable.depth,
      status: searchRunsTable.status,
      discoveredCount: searchRunsTable.discoveredCount,
      evidenceItemsGenerated: searchRunsTable.evidenceItemsGenerated,
      durationMs: searchRunsTable.durationMs,
      providers: searchRunsTable.providers,
      completedAt: searchRunsTable.completedAt,
    }).from(searchRunsTable).where(inArray(searchRunsTable.id, runIds));
    for (const row of runRows) runRowsById.set(row.id, row as typeof searchRunsTable.$inferSelect);
  }

  let businessDetails: InvestigationBusinessSummary[] = [];
  let evidenceItems: InvestigationEvidenceItem[] = [];
  let evidenceItemsCount = 0;
  let sourceConflicts: InvestigationSourceConflict[] = [];
  let aiConflicts: InvestigationAiConflict[] = [];
  let runDetails: InvestigationRunSummary[] = [];

  if (runIds.length > 0) {
    runDetails = searchRuns.map((run) => {
      const summary = runRowsById.get(run.searchRunId);
      return {
        id: run.searchRunId,
        role: run.role,
        attachedAt: run.createdAt,
        query: summary?.query ?? "Unknown",
        country: summary?.country ?? "Unknown",
        city: summary?.city ?? null,
        depth: summary?.depth ?? "unknown",
        status: summary?.status ?? "unknown",
        discoveredCount: summary?.discoveredCount ?? 0,
        evidenceItemsGenerated: summary?.evidenceItemsGenerated ?? 0,
        durationMs: summary?.durationMs ?? null,
        providers: summary?.providers ?? null,
        completedAt: summary?.completedAt ?? null,
      } satisfies InvestigationRunSummary;
    });
  }

  if (businessIds.length > 0) {
    const detailRows = await getDb()
      .select({
        id: businessesTable.id,
        name: businessesTable.name,
        category: businessesTable.category,
        city: businessesTable.city,
        country: businessesTable.country,
        website: businessesTable.website,
        verificationStatus: businessesTable.verificationStatus,
        rating: businessesTable.rating,
        reviewCount: businessesTable.reviewCount,
        leadId: leadsTable.id,
        websiteStatus: leadsTable.websiteStatus,
        aiAnalyzedAt: leadsTable.aiAnalyzedAt,
        aiOpportunityLevel: leadsTable.aiOpportunityLevel,
      })
      .from(businessesTable)
      .leftJoin(leadsTable, eq(leadsTable.businessId, businessesTable.id))
      .where(inArray(businessesTable.id, businessIds));
    const detailById = new Map(detailRows.map((row) => [row.id, row]));
    businessDetails = businesses
      .map((business): InvestigationBusinessSummary | null => {
        const row = detailById.get(business.businessId);
        if (!row) return null;
        return {
          businessId: business.businessId,
          leadId: row.leadId ?? null,
          role: business.role,
          includedReason: business.includedReason,
          name: row.name,
          category: row.category,
          city: row.city,
          country: row.country,
          website: row.website,
          websiteStatus: row.websiteStatus ?? null,
          aiStatus: row.aiAnalyzedAt ? "analyzed" : "not_analyzed",
          opportunityIndicator: row.aiOpportunityLevel ?? null,
          verificationStatus: row.verificationStatus,
          rating: row.rating,
          reviewCount: row.reviewCount,
        };
      })
      .filter((item): item is InvestigationBusinessSummary => item !== null);

    const evidenceCountResult = await getDb().select({ count: count() }).from(evidenceItemsTable).where(inArray(evidenceItemsTable.businessId, businessIds));
    if (includeEvidence) {
      evidenceItems = (await getDb().select({
        id: evidenceItemsTable.id,
        businessId: evidenceItemsTable.businessId,
        runId: evidenceItemsTable.runId,
        category: evidenceItemsTable.category,
        statement: evidenceItemsTable.statement,
        value: evidenceItemsTable.value,
        sourceType: evidenceItemsTable.sourceType,
        sourceUrl: evidenceItemsTable.sourceUrl,
        confidence: evidenceItemsTable.confidence,
        observedAt: evidenceItemsTable.observedAt,
      }).from(evidenceItemsTable).where(inArray(evidenceItemsTable.businessId, businessIds)).limit(500)) as InvestigationEvidenceItem[];
    }
    evidenceItemsCount = Number(evidenceCountResult[0]?.count ?? 0);

    sourceConflicts = (await getDb().select({
      id: evidenceConflictsTable.id,
      businessId: evidenceConflictsTable.businessId,
      category: evidenceConflictsTable.category,
      fieldKey: evidenceConflictsTable.fieldKey,
      status: evidenceConflictsTable.status,
      items: evidenceConflictsTable.items,
      observedAt: evidenceConflictsTable.observedAt,
    }).from(evidenceConflictsTable).where(inArray(evidenceConflictsTable.businessId, businessIds)).limit(200)) as InvestigationSourceConflict[];
  }

  if (runIds.length > 0) {
    aiConflicts = (await getDb().select({
      analysisId: aiAnalysesTable.id,
      businessId: aiAnalysesTable.businessId,
      validationIssues: aiAnalysesTable.validationIssues,
      validationStatus: aiAnalysesTable.validationStatus,
    }).from(aiAnalysesTable).where(inArray(aiAnalysesTable.runId, runIds)).limit(200))
      .flatMap((row): InvestigationAiConflict[] => (row.validationIssues ?? []).map((issue) => ({
        analysisId: row.analysisId,
        businessId: row.businessId,
        type: issue.type,
        claim: issue.claim,
        reason: issue.reason,
        validationStatus: row.validationStatus,
      })));
  }

  const metrics: InvestigationMetrics = {
    businesses: businesses.length,
    searchRuns: searchRuns.length,
    sources: sourceRows.length,
    evidence: evidenceItemsCount,
    supportedClaims: claimRows.filter((claim) => claim.status === "supported").length,
    findings: findingRows.length,
    opportunities: opportunityRows.length,
    unknowns: claimRows.filter((claim) => claim.claimType === "unknown").length,
    contradictions: sourceConflicts.length + aiConflicts.length,
  };
  const marketHistoryRows = await getDb().select().from(investigationMarketSyntheses).where(eq(investigationMarketSyntheses.investigationId, investigationId)).orderBy(desc(investigationMarketSyntheses.createdAt)).limit(20);
  const marketPatternRows = await getDb().select().from(investigationMarketPatterns).where(eq(investigationMarketPatterns.investigationId, investigationId));
  const marketOpportunityRows = await getDb().select().from(investigationMarketOpportunities).where(eq(investigationMarketOpportunities.investigationId, investigationId));

  return {
    ...investigation,
    searchRuns,
    businesses,
    sources: sourceRows.map(mapInvestigationSourceRow),
    claims: claimRows.map(mapInvestigationClaimRow),
    findings: findingRows.map(mapInvestigationFindingRow),
    opportunities: opportunityRows.map(mapInvestigationOpportunityRow),
    actions: actionRows.map(mapInvestigationActionRow),
    notes: noteRows.map(mapInvestigationNoteRow),
    businessDetails,
    evidenceItems,
    sourceConflicts,
    aiConflicts,
    runDetails,
    metrics,
    syntheses: (await getDb().select().from(investigationSyntheses).where(eq(investigationSyntheses.investigationId, investigationId)).orderBy(desc(investigationSyntheses.createdAt)).limit(20)).map((row) => ({
      id: row.id,
      investigationId: row.investigationId,
      provider: row.provider,
      model: row.model,
      status: row.status as InvestigationSynthesisStatus,
      executiveSummary: row.executiveSummary,
      aggregates: row.aggregates ?? null,
      findings: row.findings ?? [],
      opportunities: row.opportunities ?? [],
      risks: row.risks ?? [],
      unknowns: row.unknowns ?? [],
      actions: row.actions ?? [],
      validationStatus: row.validationStatus as InvestigationSynthesisValidationStatus,
      validationIssues: row.validationIssues ?? [],
      createdAt: row.createdAt,
    })),
    marketSyntheses: marketHistoryRows.map((row): InvestigationMarketSynthesisHistory => ({
      id: row.id,
      investigationId: row.investigationId,
      provider: row.provider,
      model: row.model,
      status: row.status as InvestigationMarketSynthesisHistory["status"],
      executiveSummary: row.executiveSummary,
      aggregates: row.aggregates ?? null,
      risks: row.risks ?? [],
      unknowns: row.unknowns ?? [],
      actions: row.actions ?? [],
      validationStatus: row.validationStatus as InvestigationMarketSynthesisHistory["validationStatus"],
      validationIssues: row.validationIssues ?? [],
      createdAt: row.createdAt,
      patterns: marketPatternRows.filter((pattern) => pattern.synthesisId === row.id).map((pattern): InvestigationMarketPattern => ({ id: pattern.id, synthesisId: pattern.synthesisId, title: pattern.title, summary: pattern.summary, patternType: pattern.patternType, confidence: pattern.confidence, affectedBusinessIds: pattern.affectedBusinessIds ?? [], evidenceIds: pattern.evidenceIds ?? [], claimIds: pattern.claimIds ?? [], claimType: pattern.claimType, status: pattern.status, unknowns: pattern.unknowns ?? [] })),
      opportunities: marketOpportunityRows.filter((opportunity) => opportunity.synthesisId === row.id).map((opportunity): InvestigationMarketOpportunity => ({ id: opportunity.id, synthesisId: opportunity.synthesisId, title: opportunity.title, statement: opportunity.statement, confidence: opportunity.confidence, affectedBusinessIds: opportunity.affectedBusinessIds ?? [], evidenceIds: opportunity.evidenceIds ?? [], riskSummary: opportunity.riskSummary, status: opportunity.status as InvestigationMarketOpportunity["status"] })),
    })),
    opportunitySyntheses: (await getDb().select().from(investigationOpportunitySyntheses).where(eq(investigationOpportunitySyntheses.investigationId, investigationId)).orderBy(desc(investigationOpportunitySyntheses.createdAt)).limit(20)).map((row): InvestigationOpportunitySynthesisHistory => ({
      id: row.id,
      investigationId: row.investigationId,
      provider: row.provider,
      model: row.model,
      status: row.status as InvestigationOpportunitySynthesisHistory["status"],
      objective: row.objective ?? null,
      signals: row.signals ?? [],
      findings: row.findings ?? [],
      opportunities: row.opportunities ?? [],
      unknowns: row.unknowns ?? [],
      actions: row.actions ?? [],
      validationStatus: row.validationStatus as InvestigationOpportunitySynthesisHistory["validationStatus"],
      validationIssues: row.validationIssues ?? [],
      createdAt: row.createdAt,
    })),
  };
}

export async function updateInvestigation(investigationId: string, patch: { title?: string; objective?: string; status?: "draft" | "active" | "completed" | "archived" }): Promise<boolean> {
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined && patch.title.trim().length > 0) update.title = patch.title.trim();
  if (patch.objective !== undefined && patch.objective.trim().length > 0) update.objective = patch.objective.trim();
  if (patch.status !== undefined) update.status = patch.status;
  const result = await getDb().update(investigations).set(update).where(eq(investigations.id, investigationId)).returning({ id: investigations.id });
  return result.length > 0;
}

export async function deleteInvestigation(investigationId: string): Promise<boolean> {
  const result = await getDb().delete(investigations).where(eq(investigations.id, investigationId)).returning({ id: investigations.id });
  return result.length > 0;
}

export async function createClaim(
  investigationId: string,
  data: Omit<InvestigationClaim, "id" | "investigationId" | "createdAt" | "updatedAt">
): Promise<InvestigationClaim> {
  if (!validateEvidenceIds(data.evidenceIds)) {
    throw new Error("Invalid evidence IDs.");
  }
  const id = newId();
  const now = new Date();
  await getDb().insert(investigationClaims).values({
    id,
    investigationId,
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return { ...data, id, investigationId, createdAt: now, updatedAt: now };
}

export async function createFinding(
  investigationId: string,
  data: Omit<InvestigationFinding, "id" | "investigationId" | "createdAt" | "updatedAt">
): Promise<InvestigationFinding> {
  const id = newId();
  const now = new Date();
  await getDb().insert(investigationFindings).values({
    id,
    investigationId,
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return { ...data, id, investigationId, createdAt: now, updatedAt: now };
}

export async function createOpportunity(
  investigationId: string,
  data: Omit<InvestigationOpportunity, "id" | "investigationId" | "createdAt" | "updatedAt">
): Promise<InvestigationOpportunity> {
  const id = newId();
  const now = new Date();
  await getDb().insert(investigationOpportunities).values({
    id,
    investigationId,
    title: data.title,
    statement: data.statement,
    confidence: data.confidence,
    businessIds: data.businessIds,
    evidenceIds: data.evidenceIds,
    riskSummary: data.riskSummary,
    status: data.status,
    economicHypothesis: data.economicHypothesis as Record<string, unknown> | null | undefined,
    createdAt: now,
    updatedAt: now,
  });
  return { ...data, id, investigationId, createdAt: now, updatedAt: now };
}

export async function createAction(
  investigationId: string,
  data: Omit<InvestigationAction, "id" | "investigationId" | "createdAt" | "updatedAt">
): Promise<InvestigationAction> {
  const id = newId();
  const now = new Date();
  await getDb().insert(investigationActions).values({
    id,
    investigationId,
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return { ...data, id, investigationId, createdAt: now, updatedAt: now };
}

export async function createNote(
  investigationId: string,
  data: Omit<InvestigationNote, "id" | "investigationId" | "createdAt" | "updatedAt">
): Promise<InvestigationNote> {
  const id = newId();
  const now = new Date();
  await getDb().insert(investigationNotes).values({
    id,
    investigationId,
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return { ...data, id, investigationId, createdAt: now, updatedAt: now };
}

export async function updateActionStatus(investigationId: string, actionId: string, status: InvestigationAction["status"]): Promise<boolean> {
  const result = await getDb()
    .update(investigationActions)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(investigationActions.id, actionId), eq(investigationActions.investigationId, investigationId)))
    .returning({ id: investigationActions.id });
  return result.length > 0;
}

export async function updateInvestigationBusinessRole(
  investigationId: string,
  businessId: string,
  role: InvestigationBusiness["role"],
): Promise<boolean> {
  const result = await getDb()
    .update(investigationBusinesses)
    .set({ role })
    .where(and(eq(investigationBusinesses.investigationId, investigationId), eq(investigationBusinesses.businessId, businessId)))
    .returning({ investigationId: investigationBusinesses.investigationId });
  if (result.length > 0) await getDb().update(investigations).set({ updatedAt: new Date() }).where(eq(investigations.id, investigationId));
  return result.length > 0;
}

export async function removeInvestigationBusiness(investigationId: string, businessId: string): Promise<boolean> {
  const result = await getDb()
    .delete(investigationBusinesses)
    .where(and(eq(investigationBusinesses.investigationId, investigationId), eq(investigationBusinesses.businessId, businessId)))
    .returning({ investigationId: investigationBusinesses.investigationId });
  if (result.length > 0) await getDb().update(investigations).set({ updatedAt: new Date() }).where(eq(investigations.id, investigationId));
  return result.length > 0;
}