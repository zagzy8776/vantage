import { describe, expect, it } from "vitest";
import { normalizedBusinessToLeadPreview } from "./shared";

describe("normalizedBusinessToLeadPreview", () => {
  it("creates a stable preview lead shape", () => {
    const lead = normalizedBusinessToLeadPreview(
      { externalId: "x", source: "foursquare", name: "Clinic", country: "Canada", city: "Toronto" },
      "lead_x",
      80,
      "poor",
      "reason",
      ["foursquare"]
    );

    expect(lead.id).toBe("lead_x");
    expect(lead.business.name).toBe("Clinic");
    expect(lead.status).toBe("discovered");
    expect(lead.business.sources).toEqual(["foursquare"]);
  });
});