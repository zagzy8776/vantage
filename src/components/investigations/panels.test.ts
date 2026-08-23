import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { InvestigationContradictions } from "./InvestigationContradictions";
import { InvestigationUnknowns } from "./InvestigationUnknowns";
import { InvestigationSearchRuns } from "./InvestigationSearchRuns";
import type {
  InvestigationSourceConflict,
  InvestigationAiConflict,
  InvestigationClaim,
  InvestigationRunSummary,
} from "@/services/investigations/types";

const nameById = new Map<string, string>([["biz_1", "N15 Hair Salon"]]);

function ssr(node: React.ReactNode): string {
  return renderToString(node).replace(/<!-- -->/g, "");
}

const sourceConflicts: InvestigationSourceConflict[] = [
  {
    id: "conf_1",
    businessId: "biz_1",
    category: "opening_hours",
    fieldKey: "closing_time",
    status: "conflicting",
    items: [
      { statement: "Closes at 9 PM", value: "9 PM", sourceType: "foursquare", confidence: "high", observedAt: "2026-08-19T00:00:00.000Z" },
      { statement: "Closes at 7 PM", value: "7 PM", sourceType: "yelp", confidence: "medium", observedAt: "2026-08-18T00:00:00.000Z" },
    ],
    observedAt: new Date("2026-08-19T00:00:00Z"),
  },
];

const aiConflicts: InvestigationAiConflict[] = [
  {
    analysisId: "ai_1",
    businessId: "biz_1",
    type: "evidence_contradiction",
    claim: "The website is unreachable.",
    reason: "PageSpeed evidence shows a successful analysis of the same URL.",
    validationStatus: "requires_review",
  },
];

describe("InvestigationContradictions", () => {
  it("separates source conflicts from AI evidence conflicts", () => {
    const html = ssr(h(InvestigationContradictions, { sourceConflicts, aiConflicts, businessNameById: nameById }));
    expect(html).toContain("Source conflicts (1)");
    expect(html).toContain("AI evidence conflicts (1)");
  });

  it("shows both competing statements with their sources", () => {
    const html = ssr(h(InvestigationContradictions, { sourceConflicts, aiConflicts, businessNameById: nameById }));
    expect(html).toContain("foursquare");
    expect(html).toContain("9 PM");
    expect(html).toContain("yelp");
    expect(html).toContain("7 PM");
    expect(html).toContain("N15 Hair Salon");
  });

  it("shows the AI claim against the contradicting evidence reason", () => {
    const html = ssr(h(InvestigationContradictions, { sourceConflicts: [], aiConflicts, businessNameById: nameById }));
    expect(html).toContain("The website is unreachable.");
    expect(html).toContain("PageSpeed evidence shows a successful analysis");
  });

  it("renders explicit empty states when there are no conflicts", () => {
    const html = ssr(h(InvestigationContradictions, { sourceConflicts: [], aiConflicts: [], businessNameById: nameById }));
    expect(html).toContain("No source conflicts detected.");
    expect(html).toContain("No AI evidence conflicts detected.");
  });
});

const unknownClaim: InvestigationClaim = {
  id: "claim_u1",
  investigationId: "inv_1",
  businessId: "biz_1",
  claimType: "unknown",
  statement: "Actual appointment volume is unknown.",
  confidence: null,
  evidenceIds: [],
  status: "requires_review",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("InvestigationUnknowns", () => {
  it("renders unknown claims with an open-question framing", () => {
    const html = ssr(h(InvestigationUnknowns, { claims: [unknownClaim], businessNameById: nameById }));
    expect(html).toContain("Actual appointment volume is unknown.");
    expect(html).toContain("These are open questions. They are not negative facts about any business.");
    expect(html).toContain("none — this is an open question");
  });

  it("never renders unknowns as negative facts — no danger styling", () => {
    const html = ssr(h(InvestigationUnknowns, { claims: [unknownClaim], businessNameById: nameById }));
    expect(html).not.toContain("border-danger");
    expect(html).toContain("border-info/30");
  });

  it("shows an explicit empty state when no unknowns exist", () => {
    const html = ssr(h(InvestigationUnknowns, { claims: [], businessNameById: nameById }));
    expect(html).toContain("No recorded unknowns");
    expect(html).toContain("Unknowns are open questions, not failures.");
  });

  it("renders synthesis knowledge gaps separately from claims", () => {
    const html = ssr(h(InvestigationUnknowns, { claims: [], businessNameById: nameById, synthesisUnknowns: ["Actual appointment volume is unknown."] }));
    expect(html).toContain("Latest synthesis knowledge gaps");
    expect(html).toContain("Actual appointment volume is unknown.");
    expect(html).not.toContain("border-danger");
  });
});

const run: InvestigationRunSummary = {
  id: "run_1",
  role: "initial_discovery",
  attachedAt: new Date("2026-08-20T00:00:00Z"),
  query: "beauty salons",
  country: "Canada",
  city: "Toronto",
  depth: "deep",
  status: "completed",
  discoveredCount: 10,
  evidenceItemsGenerated: 80,
  durationMs: 42000,
  providers: ["foursquare", "tavily"],
  completedAt: new Date("2026-08-20T01:00:00Z"),
};

describe("InvestigationSearchRuns", () => {
  it("lists contributing runs with criteria, depth, providers and counts", () => {
    const html = ssr(h(InvestigationSearchRuns, { runs: [run] }));
    expect(html).toContain("beauty salons");
    expect(html).toContain("deep");
    expect(html).toContain("initial discovery");
    expect(html).toContain("completed");
    expect(html).toContain("10 businesses");
    expect(html).toContain("80 evidence");
    expect(html).toContain("foursquare, tavily");
    expect(html).toContain("42.0s");
  });

  it("renders an explicit empty state without fabricating runs", () => {
    const html = ssr(h(InvestigationSearchRuns, { runs: [] }));
    expect(html).toContain("No search runs attached");
  });
});
