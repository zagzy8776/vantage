import { describe, expect, it } from "vitest";
import { calculateInitialOpportunityScore } from "./score";

describe("calculateInitialOpportunityScore", () => {
  it("scores no-website businesses higher than websites", () => {
    const noWebsite = calculateInitialOpportunityScore({ externalId: "1", source: "foursquare", name: "A", country: "CA", city: "Toronto" });
    const withWebsite = calculateInitialOpportunityScore({ externalId: "2", source: "foursquare", name: "B", website: "https://example.com", country: "CA", city: "Toronto" });

    expect(noWebsite.score).toBeGreaterThan(withWebsite.score - 5);
    expect(noWebsite.websiteStatus).toBe("none");
    expect(withWebsite.websiteStatus).not.toBe("none");
  });
});