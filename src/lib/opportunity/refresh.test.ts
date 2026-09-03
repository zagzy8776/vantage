import { describe, expect, it } from "vitest";
import { matchesTrackedBusiness } from "./refresh";

describe("matchesTrackedBusiness", () => {
  const business = {
    id: "biz_1",
    name: "Acme Electronics",
    phone: "+2348012345678",
    website: "https://www.acmeelectronics.example",
    city: "Benin City",
    latitude: "6.3350",
    longitude: "5.6037",
  } as never;

  it("accepts the same business when phone formatting differs", () => {
    expect(matchesTrackedBusiness({ name: "Acme Electronics", phone: "08012345678", city: "Benin City" } as never, business)).toBe(true);
  });

  it("rejects a conflicting phone for an otherwise same-name business", () => {
    expect(matchesTrackedBusiness({ name: "Acme Electronics", phone: "+2348099999999", city: "Benin City" } as never, business)).toBe(false);
  });

  it("rejects a conflicting known website domain", () => {
    expect(matchesTrackedBusiness({ name: "Acme Electronics", website: "https://other.example", city: "Benin City" } as never, business)).toBe(false);
  });

  it("rejects the same name in another city", () => {
    expect(matchesTrackedBusiness({ name: "Acme Electronics", city: "Lagos" } as never, business)).toBe(false);
  });
});
