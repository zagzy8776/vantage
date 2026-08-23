import { describe, expect, it } from "vitest";
import { normalizeCountry, normalizeGeography, normalizeRegion } from "./geography";

describe("geography normalization", () => {
  it.each([
    ["CA", "Canada", "CA"],
    ["Canada", "Canada", "CA"],
    ["NG", "Nigeria", "NG"],
    ["France", "France", "FR"],
  ])("normalizes %s", (input, name, code) => {
    expect(normalizeCountry(input)).toEqual({ countryName: name, countryCode: code });
  });

  it("preserves human-readable geography for provider queries", () => {
    expect(normalizeGeography({ country: "CA", city: "Toronto" })).toMatchObject({ countryCode: "CA", countryName: "Canada", city: "Toronto", region: "Ontario" });
    expect(normalizeGeography({ country: "NG", city: "Lagos" })).toMatchObject({ countryCode: "NG", countryName: "Nigeria", city: "Lagos" });
  });

  it("normalizes provider region codes", () => {
    expect(normalizeRegion("ON")).toBe("Ontario");
    expect(normalizeRegion("Île-de-France")).toBe("Île-de-France");
  });
});