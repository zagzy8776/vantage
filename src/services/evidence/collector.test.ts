import { describe, expect, it } from "vitest";
import { detectBookingSignals, detectContactSignals, detectEcommerceSignals, detectSocialLinks, extractInternalLinks, isPermittedPublicUrl, selectResearchLinks } from "./collector";
import { dedupeEvidence } from "./dedupe";
import { confidenceFromEvidence, verificationStatusFromEvidence } from "./confidence";
import { normalizeEvidenceItem } from "./normalizer";

describe("evidence collector", () => {
  const html = `<html><head><title>Example Clinic</title></head><body><a href="/about">About</a><a href="https://other.example/about">Other</a><a href="/book">Book appointment</a><a href="/shop">Shop</a><form><input /></form><a href="https://instagram.com/example">Instagram</a></body></html>`;

  it("filters internal public links and prioritizes useful pages", () => {
    const links = extractInternalLinks(html, "https://example.com/");
    expect(links.map((link) => link.href)).toEqual(["https://example.com/about", "https://example.com/book", "https://example.com/shop"]);
    expect(selectResearchLinks(links, 3)).toHaveLength(2);
    expect(selectResearchLinks(links, 3)).toContain("https://example.com/book");
  });

  it("detects permitted public signals", () => {
    expect(detectBookingSignals(html)).toBe(true);
    expect(detectEcommerceSignals(html)).toBe(true);
    expect(detectContactSignals(html)).toBe(true);
    expect(detectSocialLinks(html)).toContain("https://instagram.com/example");
    expect(isPermittedPublicUrl("https://example.com/page")).toBe(true);
    expect(isPermittedPublicUrl("http://127.0.0.1/private")).toBe(false);
  });
});

describe("evidence normalization and confidence", () => {
  it("normalizes, deduplicates, and keeps stronger confidence", () => {
    const first = normalizeEvidenceItem({ businessId: "biz_1", category: "booking", statement: "  Booking   available  ", sourceType: "website", explicit: true, observedAt: "2026-08-20T00:00:00.000Z" });
    const second = normalizeEvidenceItem({ businessId: "biz_1", category: "booking", statement: "Booking available", sourceType: "public_page", explicit: false, ambiguous: true, observedAt: "2026-08-21T00:00:00.000Z" });
    expect(first?.confidence).toBe("high");
    expect(dedupeEvidence([first!, second!])).toHaveLength(1);
    expect(confidenceFromEvidence({ sourceType: "search_result", explicit: false })).toBe("low");
    expect(verificationStatusFromEvidence([first!])).toBe("uncertain");
  });
});