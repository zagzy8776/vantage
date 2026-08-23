import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { FindingDrawer } from "./FindingDrawer";
import type {
  InvestigationFinding,
  InvestigationClaim,
  InvestigationBusinessSummary,
  InvestigationEvidenceItem,
  InvestigationAction,
} from "@/services/investigations/types";

const finding: InvestigationFinding = {
  id: "find_1",
  investigationId: "inv_1",
  title: "Booking workflow opportunity",
  summary: "Several businesses show no booking evidence across sources.",
  findingType: "opportunity_signal",
  confidence: 70,
  businessIds: ["biz_1", "biz_2"],
  evidenceIds: ["ev_1"],
  claimIds: ["claim_1", "claim_2"],
  status: "requires_review",
  createdAt: new Date("2026-08-20T00:00:00Z"),
  updatedAt: new Date("2026-08-20T00:00:00Z"),
};

const businesses: InvestigationBusinessSummary[] = [
  { businessId: "biz_1", role: "primary", includedReason: null, name: "N15 Hair Salon", category: "Hair care", city: "Toronto", country: "Canada", website: "https://n15.example.com", verificationStatus: "verified", rating: "4.5", reviewCount: 30 },
];

const claims: InvestigationClaim[] = [
  { id: "claim_1", investigationId: "inv_1", businessId: "biz_1", claimType: "fact", statement: "Business has no online booking link.", confidence: 90, evidenceIds: ["ev_2"], status: "supported", createdAt: new Date(), updatedAt: new Date() },
  { id: "claim_2", investigationId: "inv_1", businessId: null, claimType: "unknown", statement: "Actual appointment volume is unknown.", confidence: null, evidenceIds: [], status: "requires_review", createdAt: new Date(), updatedAt: new Date() },
];

const evidence: InvestigationEvidenceItem[] = [
  { id: "ev_1", businessId: "biz_1", runId: "run_1", category: "booking", statement: "No booking section found on website.", value: null, sourceType: "firecrawl", sourceUrl: "https://n15.example.com", confidence: "high", observedAt: new Date("2026-08-19T00:00:00Z") },
  { id: "ev_2", businessId: "biz_1", runId: "run_1", category: "website", statement: "Website responded successfully.", value: null, sourceType: "pagespeed", sourceUrl: null, confidence: "medium", observedAt: new Date("2026-08-19T00:00:00Z") },
];

const actions: InvestigationAction[] = [
  { id: "act_1", investigationId: "inv_1", title: "Verify booking workflow opportunity manually", description: "Check the sites directly.", priority: 1, actionType: "verify", status: "todo", createdAt: new Date(), updatedAt: new Date() },
];

function render(findingProp: typeof finding | null): string {
  return renderToString(
    h(FindingDrawer, {
      finding: findingProp,
      claims,
      businesses,
      evidence,
      actions,
      onClose: () => {},
    })
  ).replace(/<!-- -->/g, "");
}

describe("FindingDrawer (evidence drill-down)", () => {
  it("renders nothing when no finding is open", () => {
    expect(render(null)).toBe("");
  });

  it("renders the finding header with type and status", () => {
    const html = render(finding);
    expect(html).toContain("Booking workflow opportunity");
    expect(html).toContain("opportunity signal");
    expect(html).toContain("requires review");
    expect(html).toContain("70% confidence");
  });

  it("lists affected businesses for the drill-down", () => {
    const html = render(finding);
    expect(html).toContain("N15 Hair Salon");
    expect(html).toContain("Affected Businesses (1)");
  });

  it("distinguishes FACT and UNKNOWN claim types", () => {
    const html = render(finding);
    expect(html).toContain("fact");
    expect(html).toContain("unknown");
    expect(html).toContain("Actual appointment volume is unknown.");
  });

  it("shows evidence with original source links", () => {
    const html = render(finding);
    expect(html).toContain("No booking section found on website.");
    expect(html).toContain("Original source");
    expect(html).toContain("https://n15.example.com");
  });

  it("links related actions to the finding", () => {
    const html = render(finding);
    expect(html).toContain("Verify booking workflow opportunity manually");
  });

  it("shows explicit empty states instead of fabricated content", () => {
    const emptyFinding: InvestigationFinding = { ...finding, businessIds: [], claimIds: [], evidenceIds: [] };
    const html = renderToString(
      h(FindingDrawer, {
        finding: emptyFinding,
        claims,
        businesses,
        evidence,
        actions: [],
        onClose: () => {},
      })
    ).replace(/<!-- -->/g, "");
    expect(html).toContain("No linked businesses.");
    expect(html).toContain("No claims are linked to this finding yet.");
    expect(html).toContain("No evidence available.");
    expect(html).toContain("No actions are associated with this finding.");
  });
});