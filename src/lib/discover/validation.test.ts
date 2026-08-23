import { describe, expect, it } from "vitest";
import { validateDiscoveryQuery } from "./validation";

describe("validateDiscoveryQuery", () => {
  it("rejects empty search parameters", () => {
    const result = validateDiscoveryQuery({});
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Business type is required.");
    expect(result.errors).toContain("Country is required.");
  });

  it("rejects invalid limits", () => {
    const result = validateDiscoveryQuery({ category: "Dental clinics", country: "CA", limit: 999 });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Limit must be an integer between 1 and 250.");
  });

  it("accepts a valid query", () => {
    const result = validateDiscoveryQuery({ category: "Dental clinics", country: "CA", limit: 25, depth: "standard" });
    expect(result.ok).toBe(true);
    expect(result.query?.category).toBe("Dental clinics");
  });
});