import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  numeric,
} from "drizzle-orm/pg-core";

export const businessSourceEnum = pgEnum("business_source", ["foursquare", "yelp", "manual", "import", "web"]);
export const leadStatusEnum = pgEnum("lead_status", ["discovered", "analyzing", "qualified", "contacted", "replied", "won"]);
export const websiteStatusEnum = pgEnum("website_status", ["none", "unknown", "unreachable", "poor", "fair", "good"]);
export const businessRelationshipConfidenceEnum = pgEnum("business_relationship_confidence", ["low", "medium", "high"]);
export const businessRelationshipStatusEnum = pgEnum("business_relationship_status", ["pending", "confirmed"]);
export const websiteAnalysisStrategyEnum = pgEnum("website_analysis_strategy", ["mobile", "desktop"]);
export const websiteAnalysisStatusEnum = pgEnum("website_analysis_status", ["success", "failed"]);
export const aiOpportunityLevelEnum = pgEnum("ai_opportunity_level", ["very-low", "low", "medium", "high", "very-high"]);
export const aiAnalysisStatusEnum = pgEnum("ai_analysis_status", ["success", "failed"]);
export const businessVerificationStatusEnum = pgEnum("business_verification_status", ["verified", "likely", "uncertain", "rejected"]);
export const evidenceCategoryEnum = pgEnum("evidence_category", ["business_identity", "business_category", "location", "contact", "website", "services", "products", "pricing", "booking", "ecommerce", "social_presence", "opening_hours", "about", "technology", "customer_signal", "brand_signal", "content_signal"]);
export const evidenceSourceTypeEnum = pgEnum("evidence_source_type", ["foursquare", "yelp", "tavily", "exa", "firecrawl", "pagespeed", "website", "public_page", "search_result"]);
export const evidenceConfidenceEnum = pgEnum("evidence_confidence", ["high", "medium", "low"]);
export const searchDepthEnum = pgEnum("search_depth", ["quick", "standard", "deep"]);

export const investigationTypeEnum = pgEnum("investigation_type", ["company", "industry", "market", "problem", "service_opportunity"]);
export const investigationStatusEnum = pgEnum("investigation_status", ["draft", "active", "completed", "archived"]);
export const investigationSearchRunRoleEnum = pgEnum("investigation_search_run_role", ["initial_discovery", "refresh", "supplemental", "comparison"]);
export const investigationBusinessRoleEnum = pgEnum("investigation_business_role", ["primary", "comparison", "candidate", "excluded"]);
export const investigationClaimTypeEnum = pgEnum("investigation_claim_type", ["fact", "derived", "inference", "unknown"]);
export const investigationClaimStatusEnum = pgEnum("investigation_claim_status", ["supported", "requires_review", "rejected"]);
export const investigationFindingTypeEnum = pgEnum("investigation_finding_type", ["market_pattern", "business_pattern", "operational_signal", "digital_signal", "opportunity_signal", "risk"]);
export const investigationOpportunityStatusEnum = pgEnum("investigation_opportunity_status", ["hypothesis", "needs_validation", "supported", "rejected"]);
export const investigationActionTypeEnum = pgEnum("investigation_action_type", ["verify", "interview", "research", "compare", "collect_data", "manual_review"]);
export const investigationActionStatusEnum = pgEnum("investigation_action_status", ["todo", "in_progress", "completed", "cancelled"]);

export const canonicalBusinesses = pgTable(
  "canonical_businesses",
  {
    id: text("id").primaryKey(),
    signature: text("signature").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    country: text("country"),
    city: text("city"),
    sourceCount: integer("source_count").notNull().default(1),
    discoveredAt: timestamp("discovered_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    signatureUnique: uniqueIndex("canonical_business_signature_unique").on(table.signature),
    nameIndex: index("canonical_business_name_idx").on(table.name),
    cityIndex: index("canonical_business_city_idx").on(table.city),
    countryIndex: index("canonical_business_country_idx").on(table.country),
  })
);

export const businesses = pgTable(
  "businesses",
  {
    id: text("id").primaryKey(),
    externalId: text("external_id").notNull(),
    source: businessSourceEnum("source").notNull(),
    canonicalBusinessId: text("canonical_business_id").references(() => canonicalBusinesses.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    address: text("address"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    area: text("area"),
    street: text("street"),
    latitude: numeric("latitude", { precision: 10, scale: 6 }),
    longitude: numeric("longitude", { precision: 10, scale: 6 }),
    phone: text("phone"),
    website: text("website"),
    websiteCanonicalUrl: text("website_canonical_url"),
    websiteNormalizedUrl: text("website_normalized_url"),
    rating: numeric("rating", { precision: 3, scale: 2 }),
    reviewCount: integer("review_count"),
    priceLevel: integer("price_level"),
    verificationStatus: businessVerificationStatusEnum("verification_status").notNull().default("uncertain"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    sourceExternalUnique: uniqueIndex("business_source_external_unique").on(table.source, table.externalId),
    canonicalBusinessIndex: index("business_canonical_business_idx").on(table.canonicalBusinessId),
    sourceIndex: index("business_source_idx").on(table.source),
    countryIndex: index("business_country_idx").on(table.country),
    cityIndex: index("business_city_idx").on(table.city),
    categoryIndex: index("business_category_idx").on(table.category),
    websiteIndex: index("business_website_idx").on(table.website),
    websiteCanonicalIndex: index("business_website_canonical_idx").on(table.websiteCanonicalUrl),
    websiteNormalizedIndex: index("business_website_normalized_idx").on(table.websiteNormalizedUrl),
  })
);

export const websiteAnalyses = pgTable(
  "website_analyses",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    runId: text("run_id"),
    url: text("url").notNull(),
    strategy: websiteAnalysisStrategyEnum("strategy").notNull(),
    performanceScore: integer("performance_score"),
    accessibilityScore: integer("accessibility_score"),
    bestPracticesScore: integer("best_practices_score"),
    seoScore: integer("seo_score"),
    status: websiteAnalysisStatusEnum("status").notNull(),
    errorCode: text("error_code"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => ({
    businessIndex: index("website_analysis_business_idx").on(table.businessId),
    businessStrategyIndex: index("website_analysis_business_strategy_idx").on(table.businessId, table.strategy),
    analyzedAtIndex: index("website_analysis_analyzed_at_idx").on(table.analyzedAt),
  })
);

export const businessRelationships = pgTable(
  "business_relationships",
  {
    id: text("id").primaryKey(),
    leftBusinessId: text("left_business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    rightBusinessId: text("right_business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    confidence: businessRelationshipConfidenceEnum("confidence").notNull(),
    status: businessRelationshipStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    pairUnique: uniqueIndex("business_relationship_pair_unique").on(table.leftBusinessId, table.rightBusinessId),
    leftIndex: index("business_relationship_left_idx").on(table.leftBusinessId),
    rightIndex: index("business_relationship_right_idx").on(table.rightBusinessId),
    confidenceIndex: index("business_relationship_confidence_idx").on(table.confidence),
    statusIndex: index("business_relationship_status_idx").on(table.status),
  })
);

export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    opportunityScore: integer("opportunity_score").notNull(),
    status: leadStatusEnum("status").notNull().default("discovered"),
    websiteStatus: websiteStatusEnum("website_status").notNull().default("none"),
    aiOpportunityScore: integer("ai_opportunity_score"),
    aiOpportunityLevel: aiOpportunityLevelEnum("ai_opportunity_level"),
    aiAnalyzedAt: timestamp("ai_analyzed_at", { withTimezone: true, mode: "date" }),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    businessUnique: uniqueIndex("lead_business_unique").on(table.businessId),
    scoreIndex: index("lead_opportunity_score_idx").on(table.opportunityScore),
    statusIndex: index("lead_status_idx").on(table.status),
    websiteStatusIndex: index("lead_website_status_idx").on(table.websiteStatus),
    aiOpportunityScoreIndex: index("lead_ai_opportunity_score_idx").on(table.aiOpportunityScore),
    aiOpportunityLevelIndex: index("lead_ai_opportunity_level_idx").on(table.aiOpportunityLevel),
  })
);

export const aiAnalyses = pgTable(
  "ai_analyses",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    runId: text("run_id"),
    provider: text("provider").notNull(),
    model: text("model"),
    status: aiAnalysisStatusEnum("status").notNull().default("success"),
    opportunityScore: integer("opportunity_score"),
    opportunityLevel: aiOpportunityLevelEnum("opportunity_level"),
    businessSummary: text("business_summary"),
    strengths: jsonb("strengths").$type<string[]>(),
    weaknesses: jsonb("weaknesses").$type<string[]>(),
    opportunities: jsonb("opportunities").$type<string[]>(),
    risks: jsonb("risks").$type<string[]>(),
    recommendedServices: jsonb("recommended_services").$type<string[]>(),
    evidence: jsonb("evidence").$type<Array<{ statement: string; type: "fact" | "derived" | "inference"; source: string; evidenceIds?: string[]; confidence?: number }>>(),
    unknowns: jsonb("unknowns").$type<string[]>(),
    reasoning: text("reasoning"),
    confidence: integer("confidence"),
    validationStatus: text("validation_status").notNull().default("legacy"),
    validationIssues: jsonb("validation_issues").$type<Array<{ type: string; claim: string; reason: string; evidenceIds?: string[] }>>(),
    fallbackUsed: integer("fallback_used").notNull().default(0),
    attempts: integer("attempts").notNull().default(1),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    businessIndex: index("ai_analysis_business_idx").on(table.businessId),
    leadIndex: index("ai_analysis_lead_idx").on(table.leadId),
    createdAtIndex: index("ai_analysis_created_at_idx").on(table.createdAt),
    statusIndex: index("ai_analysis_status_idx").on(table.status),
  })
);

export const evidenceItems = pgTable(
  "evidence_items",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    runId: text("run_id"),
    category: evidenceCategoryEnum("category").notNull(),
    statement: text("statement").notNull(),
    value: text("value"),
    sourceType: evidenceSourceTypeEnum("source_type").notNull(),
    sourceUrl: text("source_url"),
    confidence: evidenceConfidenceEnum("confidence").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => ({
    businessIndex: index("evidence_item_business_idx").on(table.businessId),
    categoryIndex: index("evidence_item_category_idx").on(table.category),
    observedAtIndex: index("evidence_item_observed_at_idx").on(table.observedAt),
  })
);

export const searchRuns = pgTable(
  "search_runs",
  {
    id: text("id").primaryKey(),
    query: text("query").notNull(),
    country: text("country").notNull(),
    city: text("city"),
    depth: searchDepthEnum("depth").notNull(),
    queryExpansion: integer("query_expansion").notNull().default(0),
    evidenceEnrichment: integer("evidence_enrichment").notNull().default(0),
    searchSource: text("search_source"),
    providers: jsonb("providers").$type<string[]>(),
    externalSearchProviders: jsonb("external_search_providers").$type<string[]>(),
    tavilyQueries: integer("tavily_queries").notNull().default(0),
    exaQueries: integer("exa_queries").notNull().default(0),
    candidatesReturned: integer("candidates_returned").notNull().default(0),
    candidatesPromoted: integer("candidates_promoted").notNull().default(0),
    officialDomainsIdentified: integer("official_domains_identified").notNull().default(0),
    firecrawlEnriched: integer("firecrawl_enriched").notNull().default(0),
    evidenceItemsGenerated: integer("evidence_items_generated").notNull().default(0),
    failures: jsonb("failures").$type<Array<Record<string, unknown>>>(),
    discoveredCount: integer("discovered_count").notNull().default(0),
    enrichedCount: integer("enriched_count").notNull().default(0),
    verifiedCount: integer("verified_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    durationMs: integer("duration_ms"),
    status: text("status").notNull().default("completed"),
    errorCode: text("error_code"),
    workerId: text("worker_id"),
    lockAcquiredAt: timestamp("lock_acquired_at", { withTimezone: true, mode: "date" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    stages: jsonb("stages").$type<Record<string, { status: string; startedAt?: string; completedAt?: string; durationMs?: number; count?: number; errorCount?: number; provider?: string }>>(),
    providerMetrics: jsonb("provider_metrics").$type<Record<string, unknown>>(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    createdAtIndex: index("search_run_created_at_idx").on(table.createdAt),
    depthIndex: index("search_run_depth_idx").on(table.depth),
  })
);

export const evidenceConflicts = pgTable(
  "evidence_conflicts",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    category: evidenceCategoryEnum("category").notNull(),
    fieldKey: text("field_key").notNull(),
    status: text("status").notNull().default("conflicting"),
    items: jsonb("items").$type<Array<{ statement: string; value?: string; sourceType: string; sourceUrl?: string; confidence: string; observedAt: string }>>().notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => ({
    businessIndex: index("evidence_conflict_business_idx").on(table.businessId),
    fieldIndex: index("evidence_conflict_field_idx").on(table.category, table.fieldKey),
  })
);

export const investigations = pgTable(
  "investigations",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    objective: text("objective").notNull(),
    investigationType: investigationTypeEnum("investigation_type").notNull(),
    status: investigationStatusEnum("status").notNull().default("draft"),
    industry: text("industry"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    criteria: jsonb("criteria").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    statusIndex: index("investigations_status_idx").on(table.status),
    typeIndex: index("investigations_type_idx").on(table.investigationType),
    countryCityIndex: index("investigations_country_city_idx").on(table.country, table.city),
    createdAtIndex: index("investigations_created_at_idx").on(table.createdAt),
  })
);

export const investigationSearchRuns = pgTable(
  "investigation_search_runs",
  {
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    searchRunId: text("search_run_id").notNull().references(() => searchRuns.id, { onDelete: "cascade" }),
    role: investigationSearchRunRoleEnum("role").notNull().default("initial_discovery"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    pk: index("investigation_search_runs_pk").on(table.investigationId, table.searchRunId),
    searchRunIndex: index("investigation_search_runs_search_run_idx").on(table.searchRunId),
  })
);

export const investigationBusinesses = pgTable(
  "investigation_businesses",
  {
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    role: investigationBusinessRoleEnum("role").notNull().default("primary"),
    includedReason: text("included_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    pk: index("investigation_businesses_pk").on(table.investigationId, table.businessId),
    businessIndex: index("investigation_businesses_business_idx").on(table.businessId),
  })
);

export const investigationSources = pgTable(
  "investigation_sources",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    searchRunId: text("search_run_id").references(() => searchRuns.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    sourceUrl: text("source_url"),
    sourceType: text("source_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_sources_investigation_idx").on(table.investigationId),
    searchRunIndex: index("investigation_sources_search_run_idx").on(table.searchRunId),
  })
);

export const investigationClaims = pgTable(
  "investigation_claims",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    businessId: text("business_id").references(() => businesses.id, { onDelete: "set null" }),
    claimType: investigationClaimTypeEnum("claim_type").notNull(),
    statement: text("statement").notNull(),
    confidence: integer("confidence"),
    evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull().default([]),
    status: investigationClaimStatusEnum("status").notNull().default("requires_review"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_claims_investigation_idx").on(table.investigationId),
    businessIndex: index("investigation_claims_business_idx").on(table.businessId),
    statusIndex: index("investigation_claims_status_idx").on(table.status),
  })
);

export const investigationFindings = pgTable(
  "investigation_findings",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    findingType: investigationFindingTypeEnum("finding_type").notNull(),
    confidence: integer("confidence"),
    businessIds: jsonb("business_ids").$type<string[]>().notNull().default([]),
    evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull().default([]),
    claimIds: jsonb("claim_ids").$type<string[]>().notNull().default([]),
    status: investigationClaimStatusEnum("status").notNull().default("requires_review"),
    unknowns: jsonb("unknowns").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_findings_investigation_idx").on(table.investigationId),
  })
);

export const investigationOpportunities = pgTable(
  "investigation_opportunities",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    statement: text("statement").notNull(),
    confidence: integer("confidence"),
    businessIds: jsonb("business_ids").$type<string[]>().notNull().default([]),
    evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull().default([]),
    riskSummary: text("risk_summary"),
    economicHypothesis: jsonb("economic_hypothesis").$type<Record<string, unknown>>(),
    status: investigationOpportunityStatusEnum("status").notNull().default("hypothesis"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_opportunities_investigation_idx").on(table.investigationId),
    statusIndex: index("investigation_opportunities_status_idx").on(table.status),
  })
);

export const investigationActions = pgTable(
  "investigation_actions",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    priority: integer("priority").notNull().default(0),
    actionType: investigationActionTypeEnum("action_type").notNull(),
    status: investigationActionStatusEnum("status").notNull().default("todo"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_actions_investigation_idx").on(table.investigationId),
    statusIndex: index("investigation_actions_status_idx").on(table.status),
  })
);

export const investigationNotes = pgTable(
  "investigation_notes",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    author: text("author").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_notes_investigation_idx").on(table.investigationId),
  })
);

export const investigationSyntheses = pgTable(
  "investigation_syntheses",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model"),
    status: text("status").notNull(),
    executiveSummary: text("executive_summary"),
    aggregates: jsonb("aggregates").$type<Record<string, unknown>>(),
    findings: jsonb("findings").$type<unknown[]>(),
    opportunities: jsonb("opportunities").$type<unknown[]>(),
    risks: jsonb("risks").$type<string[]>(),
    unknowns: jsonb("unknowns").$type<string[]>(),
    actions: jsonb("actions").$type<unknown[]>(),
    validationStatus: text("validation_status").notNull(),
    validationIssues: jsonb("validation_issues").$type<Array<Record<string, unknown>>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_syntheses_investigation_idx").on(table.investigationId),
    createdAtIndex: index("investigation_syntheses_created_at_idx").on(table.createdAt),
    statusIndex: index("investigation_syntheses_status_idx").on(table.status),
  })
);

export const investigationOpportunitySyntheses = pgTable(
  "investigation_opportunity_syntheses",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model"),
    status: text("status").notNull(),
    objective: jsonb("objective").$type<Record<string, unknown>>(),
    signals: jsonb("signals").$type<unknown[]>(),
    findings: jsonb("findings").$type<unknown[]>(),
    opportunities: jsonb("opportunities").$type<unknown[]>(),
    unknowns: jsonb("unknowns").$type<string[]>(),
    actions: jsonb("actions").$type<unknown[]>(),
    validationStatus: text("validation_status").notNull(),
    validationIssues: jsonb("validation_issues").$type<Array<Record<string, unknown>>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_opportunity_syntheses_investigation_idx").on(table.investigationId),
    createdAtIndex: index("investigation_opportunity_syntheses_created_at_idx").on(table.createdAt),
    statusIndex: index("investigation_opportunity_syntheses_status_idx").on(table.status),
  })
);

export const investigationPlans = pgTable(
  "investigation_plans",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    objectiveSnapshot: jsonb("objective_snapshot").$type<Record<string, unknown>>().notNull(),
    createdBy: text("created_by").notNull().default("investigator"),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_plans_investigation_idx").on(table.investigationId),
    versionIndex: index("investigation_plans_version_idx").on(table.investigationId, table.version),
    statusIndex: index("investigation_plans_status_idx").on(table.status),
  })
);

export const investigationPlanSteps = pgTable(
  "investigation_plan_steps",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull().references(() => investigationPlans.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    objective: text("objective").notNull(),
    reason: text("reason").notNull(),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
    dependencies: jsonb("dependencies").$type<string[]>().notNull().default([]),
    budget: jsonb("budget").$type<Record<string, number>>().notNull().default({}),
    enabled: integer("enabled").notNull().default(1),
    status: text("status").notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    planIndex: index("investigation_plan_steps_plan_idx").on(table.planId),
    orderIndex: index("investigation_plan_steps_order_idx").on(table.planId, table.stepOrder),
  })
);

export const investigationPlanExecutions = pgTable(
  "investigation_plan_executions",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => investigationPlans.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    plannedBudget: jsonb("planned_budget").$type<Record<string, number>>().notNull().default({}),
    actualUsage: jsonb("actual_usage").$type<Record<string, number>>().notNull().default({}),
    failureReason: text("failure_reason"),
    currentStepId: text("current_step_id"),
    cancellationRequested: integer("cancellation_requested").notNull().default(0),
    providerUsage: jsonb("provider_usage").$type<Array<Record<string, unknown>>>().notNull().default([]),
    workerId: text("worker_id"),
    lockAcquiredAt: timestamp("lock_acquired_at", { withTimezone: true, mode: "date" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    planIndex: index("investigation_plan_executions_plan_idx").on(table.planId),
    investigationIndex: index("investigation_plan_executions_investigation_idx").on(table.investigationId),
    statusIndex: index("investigation_plan_executions_status_idx").on(table.status),
    workerIndex: index("investigation_plan_executions_worker_idx").on(table.workerId),
  })
);

export const investigationPlanExecutionSteps = pgTable(
  "investigation_plan_execution_steps",
  {
    id: text("id").primaryKey(),
    executionId: text("execution_id").notNull().references(() => investigationPlanExecutions.id, { onDelete: "cascade" }),
    planStepId: text("plan_step_id").notNull().references(() => investigationPlanSteps.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    provider: text("provider"),
    searchRunIds: jsonb("search_run_ids").$type<string[]>().notNull().default([]),
    outputIds: jsonb("output_ids").$type<string[]>().notNull().default([]),
    actualUsage: jsonb("actual_usage").$type<Record<string, number>>().notNull().default({}),
    reason: text("reason"),
    errorCategory: text("error_category"),
    safeMessage: text("safe_message"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    executionIndex: index("investigation_plan_execution_steps_execution_idx").on(table.executionId),
    planStepIndex: index("investigation_plan_execution_steps_plan_step_idx").on(table.planStepId),
  })
);

export const investigationMarketSyntheses = pgTable(
  "investigation_market_syntheses",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model"),
    status: text("status").notNull(),
    executiveSummary: text("executive_summary"),
    aggregates: jsonb("aggregates").$type<Record<string, unknown>>(),
    risks: jsonb("risks").$type<string[]>(),
    unknowns: jsonb("unknowns").$type<string[]>(),
    actions: jsonb("actions").$type<unknown[]>(),
    validationStatus: text("validation_status").notNull(),
    validationIssues: jsonb("validation_issues").$type<Array<Record<string, unknown>>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_market_syntheses_investigation_idx").on(table.investigationId),
    createdAtIndex: index("investigation_market_syntheses_created_at_idx").on(table.createdAt),
    statusIndex: index("investigation_market_syntheses_status_idx").on(table.status),
  })
);

export const investigationMarketPatterns = pgTable(
  "investigation_market_patterns",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    synthesisId: text("synthesis_id").notNull().references(() => investigationMarketSyntheses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    patternType: text("pattern_type").notNull(),
    confidence: integer("confidence"),
    affectedBusinessIds: jsonb("affected_business_ids").$type<string[]>().notNull().default([]),
    evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull().default([]),
    claimIds: jsonb("claim_ids").$type<string[]>().notNull().default([]),
    claimType: text("claim_type").notNull(),
    status: text("status").notNull(),
    unknowns: jsonb("unknowns").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_market_patterns_investigation_idx").on(table.investigationId),
    synthesisIndex: index("investigation_market_patterns_synthesis_idx").on(table.synthesisId),
  })
);

export const investigationMarketOpportunities = pgTable(
  "investigation_market_opportunities",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
    synthesisId: text("synthesis_id").notNull().references(() => investigationMarketSyntheses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    statement: text("statement").notNull(),
    confidence: integer("confidence"),
    affectedBusinessIds: jsonb("affected_business_ids").$type<string[]>().notNull().default([]),
    evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull().default([]),
    riskSummary: text("risk_summary").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIndex: index("investigation_market_opportunities_investigation_idx").on(table.investigationId),
    synthesisIndex: index("investigation_market_opportunities_synthesis_idx").on(table.synthesisId),
  })
);

export type BusinessRow = typeof businesses.$inferSelect;
export type NewBusinessRow = typeof businesses.$inferInsert;
export type CanonicalBusinessRow = typeof canonicalBusinesses.$inferSelect;
export type NewCanonicalBusinessRow = typeof canonicalBusinesses.$inferInsert;
export type BusinessRelationshipRow = typeof businessRelationships.$inferSelect;
export type NewBusinessRelationshipRow = typeof businessRelationships.$inferInsert;
export type LeadRow = typeof leads.$inferSelect;
export type NewLeadRow = typeof leads.$inferInsert;
export type WebsiteAnalysisRow = typeof websiteAnalyses.$inferSelect;
export type NewWebsiteAnalysisRow = typeof websiteAnalyses.$inferInsert;
export type AIAnalysisRow = typeof aiAnalyses.$inferSelect;
export type NewAIAnalysisRow = typeof aiAnalyses.$inferInsert;
export type EvidenceItemRow = typeof evidenceItems.$inferSelect;
export type NewEvidenceItemRow = typeof evidenceItems.$inferInsert;
export type SearchRunRow = typeof searchRuns.$inferSelect;
export type NewSearchRunRow = typeof searchRuns.$inferInsert;
export type EvidenceConflictRow = typeof evidenceConflicts.$inferSelect;
export type NewEvidenceConflictRow = typeof evidenceConflicts.$inferInsert;
export type InvestigationRow = typeof investigations.$inferSelect;
export type NewInvestigationRow = typeof investigations.$inferInsert;
export type InvestigationSearchRunRow = typeof investigationSearchRuns.$inferSelect;
export type NewInvestigationSearchRunRow = typeof investigationSearchRuns.$inferInsert;
export type InvestigationBusinessRow = typeof investigationBusinesses.$inferSelect;
export type NewInvestigationBusinessRow = typeof investigationBusinesses.$inferInsert;
export type InvestigationSourceRow = typeof investigationSources.$inferSelect;
export type NewInvestigationSourceRow = typeof investigationSources.$inferInsert;
export type InvestigationClaimRow = typeof investigationClaims.$inferSelect;
export type NewInvestigationClaimRow = typeof investigationClaims.$inferInsert;
export type InvestigationFindingRow = typeof investigationFindings.$inferSelect;
export type NewInvestigationFindingRow = typeof investigationFindings.$inferInsert;
export type InvestigationOpportunityRow = typeof investigationOpportunities.$inferSelect;
export type NewInvestigationOpportunityRow = typeof investigationOpportunities.$inferInsert;
export type InvestigationActionRow = typeof investigationActions.$inferSelect;
export type NewInvestigationActionRow = typeof investigationActions.$inferInsert;
export type InvestigationNoteRow = typeof investigationNotes.$inferSelect;
export type NewInvestigationNoteRow = typeof investigationNotes.$inferInsert;
export type InvestigationSynthesisRow = typeof investigationSyntheses.$inferSelect;
export type NewInvestigationSynthesisRow = typeof investigationSyntheses.$inferInsert;
export type InvestigationOpportunitySynthesisRow = typeof investigationOpportunitySyntheses.$inferSelect;
export type NewInvestigationOpportunitySynthesisRow = typeof investigationOpportunitySyntheses.$inferInsert;
export type InvestigationPlanRow = typeof investigationPlans.$inferSelect;
export type NewInvestigationPlanRow = typeof investigationPlans.$inferInsert;
export type InvestigationPlanStepRow = typeof investigationPlanSteps.$inferSelect;
export type NewInvestigationPlanStepRow = typeof investigationPlanSteps.$inferInsert;
export type InvestigationPlanExecutionRow = typeof investigationPlanExecutions.$inferSelect;
export type NewInvestigationPlanExecutionRow = typeof investigationPlanExecutions.$inferInsert;
export type InvestigationPlanExecutionStepRow = typeof investigationPlanExecutionSteps.$inferSelect;
export type NewInvestigationPlanExecutionStepRow = typeof investigationPlanExecutionSteps.$inferInsert;
export type InvestigationMarketSynthesisRow = typeof investigationMarketSyntheses.$inferSelect;
export type NewInvestigationMarketSynthesisRow = typeof investigationMarketSyntheses.$inferInsert;
export type InvestigationMarketPatternRow = typeof investigationMarketPatterns.$inferSelect;
export type NewInvestigationMarketPatternRow = typeof investigationMarketPatterns.$inferInsert;
export type InvestigationMarketOpportunityRow = typeof investigationMarketOpportunities.$inferSelect;

// ---------------------------------------------------------------------------
// PH1B: Identity, sessions, and tenant isolation (migration 0015 + 0016)
// ---------------------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    organizationId: text("organization_id"),
    passwordHash: text("password_hash"),
    isActive: boolean("is_active").notNull().default(true),
    emailVerified: boolean("email_verified").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  },
  (table) => [index("idx_users_email").on(table.email)],
);

export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** HMAC-SHA256 of the 6-digit code - plaintext codes are never stored */
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    verifiedAt: timestamp("verified_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("idx_email_verifications_user_id").on(table.userId)],
);

export const authSessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    organizationId: text("organization_id"),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  },
  (table) => [index("idx_sessions_user_id").on(table.userId)],
);

export const investigationAccess = pgTable(
  "investigation_access",
  {
    id: text("id").primaryKey(),
    investigationId: text("investigation_id").notNull().unique(),
    ownerId: text("owner_id").notNull(),
    organizationId: text("organization_id"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("idx_investigation_access_investigation").on(table.investigationId)],
);

export const investigationShares = pgTable(
  "investigation_shares",
  {
    id: text("id").primaryKey(),
    investigationAccessId: text("investigation_access_id").notNull(),
    userId: text("user_id").notNull(),
    permission: text("permission").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("idx_investigation_shares_user_id").on(table.userId)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type AuthSessionRow = typeof authSessions.$inferSelect;
export type InvestigationAccessRow = typeof investigationAccess.$inferSelect;
export type InvestigationShareRow = typeof investigationShares.$inferSelect;