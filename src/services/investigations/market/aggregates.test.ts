import { describe, expect, it } from "vitest";
import { countDistinctBusinessSignals } from "./aggregates";

describe("market distinct-business aggregates", () => {
  it("counts each business once per signal instead of counting evidence rows", () => {
    const result = countDistinctBusinessSignals([
      { businessId: "biz_1", category: "booking" },
      { businessId: "biz_1", category: "booking" },
      { businessId: "biz_2", category: "booking" },
      { businessId: "biz_2", category: "ecommerce" },
    ]);
    expect(result.booking).toBe(2);
    expect(result.ecommerce).toBe(1);
  });
});