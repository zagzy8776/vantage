import { beforeEach, describe, expect, it, vi } from "vitest";

const routerMock = vi.hoisted(() => ({
  generateWithFallback: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  const makeQuery = (result: unknown[]) => {
    const query = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn(),
    };
    for (const method of ["from", "innerJoin", "where", "orderBy"]) query[method as keyof typeof query].mockReturnValue(query);
    query.limit.mockResolvedValue(result);
    return query;
  };
  const leadQuery = makeQuery([{
    leadId: "lead_1",
    businessId: "biz_1",
    name: "Test Clinic",
    category: "Dental clinics",
    address: "1 Main St",
    country: "Canada",
    region: "Ontario",
    city: "Toronto",
    area: null,
    phone: "+1 555 0100",
    website: null,
    rating: "4.7",
    reviewCount: 42,
    source: "foursquare",
    websiteStatus: "none",
    id: "ev_rating_1",
  }]);
  const websiteQuery = makeQuery([]);
  const evidenceQuery = makeQuery([{ id: "ev_rating_1", category: "customer_signal", statement: "Business provider reports a 4.7 rating.", value: "4.7", sourceType: "foursquare", sourceUrl: null, confidence: "high", observedAt: new Date("2026-08-20T00:00:00.000Z") }]);
  const selectQueries = [leadQuery, websiteQuery, evidenceQuery];
  let selectIndex = 0;
  const chain = {
    select: vi.fn(() => selectQueries[selectIndex++ % selectQueries.length]),
    resetSelect: () => { selectIndex = 0; },
    insert: vi.fn(),
    values: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
  };
  chain.insert.mockReturnValue(chain);
  chain.values.mockResolvedValue(undefined);
  chain.update.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.where.mockResolvedValue(undefined);
  return chain;
});

vi.mock("@/lib/db", () => ({ getDb: () => dbMock }));
vi.mock("@/providers/ai/router", () => routerMock);

import { analyzeLead } from "./lead-analysis";

describe("lead intelligence service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.resetSelect();
    routerMock.generateWithFallback.mockResolvedValue({
      content: JSON.stringify({
        businessSummary: "A dental clinic identified from provider evidence.",
        opportunityLevel: "low",
        opportunityScore: 24,
        strengths: ["Provider rating exists"],
        weaknesses: [],
        opportunities: [],
        risks: ["No website evidence was supplied"],
        recommendedServices: [],
        evidence: [{ statement: "The business record reports a 4.7 rating.", type: "fact", source: "business.rating", evidenceIds: ["ev_rating_1"], confidence: 100 }],
        unknowns: ["Online booking availability is unknown."],
        reasoning: "There is not enough evidence to support a strong project opportunity.",
        confidence: 62,
      }),
      metadata: { provider: "groq", model: "test-model", fallbackUsed: false, attempts: 1 },
      usage: { totalTokens: 100 },
    });
  });

  it("analyzes a business without website evidence and persists both records", async () => {
    const result = await analyzeLead("lead_1");
    expect(result.opportunityScore).toBe(24);
    expect(result.provider).toBe("groq");
    expect(result.validationStatus).toBe("supported");
    expect(dbMock.insert).toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalled();
  });

  it("blocks trusted score updates when a claim lacks evidence references", async () => {
    routerMock.generateWithFallback.mockResolvedValueOnce({
      content: JSON.stringify({
        businessSummary: "A dental clinic identified from provider evidence.", opportunityLevel: "low", opportunityScore: 24, strengths: [], weaknesses: [], opportunities: [], risks: [], recommendedServices: [], evidence: [{ statement: "The business has a website.", type: "fact", source: "test", evidenceIds: [], confidence: 80 }], unknowns: [], reasoning: "Review required.", confidence: 40,
      }),
      metadata: { provider: "groq", model: "test-model", fallbackUsed: false, attempts: 1 },
    });
    const result = await analyzeLead("lead_1");
    expect(result.validationStatus).toBe("requires_review");
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("does not accept malformed AI output", async () => {
    routerMock.generateWithFallback.mockResolvedValueOnce({
      content: "not json",
      metadata: { provider: "groq", fallbackUsed: false, attempts: 1 },
    });
    await expect(analyzeLead("lead_1")).rejects.toThrow();
  });
});