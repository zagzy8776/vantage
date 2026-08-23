import { describe, expect, it } from "vitest";
import { verifyOfficialWebsite } from "./verify";

describe("official website verification", () => {
  it.each([
    "https://www.yelp.com/biz/example",
    "https://foursquare.com/v/example",
    "https://www.google.com/maps/place/example",
    "https://www.facebook.com/example",
    "https://www.instagram.com/example",
  ])("keeps %s as a source reference but not an official website", (url) => {
    const result = verifyOfficialWebsite(url, { businessName: "Example Salon", city: "Toronto" });
    expect(result.officialWebsite).toBe(false);
    expect(result.sourceReference).toBe(true);
    expect(result.status).toBe("rejected");
  });

  it("gives a business-like domain a deterministic confidence status", () => {
    const result = verifyOfficialWebsite("https://example-salon-toronto.ca", { businessName: "Example Salon", city: "Toronto" });
    expect(result.officialWebsite).toBe(true);
    expect(result.status).toBe("verified");
    expect(result.confidenceScore).toBeGreaterThan(70);
  });
});