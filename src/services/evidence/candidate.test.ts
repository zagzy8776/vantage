import { describe, expect, it } from "vitest";
import { extractWebCandidate, extractWebCandidates } from "./candidate";

describe("external web candidate extraction", () => {
  it("extracts an uncertain web candidate without inventing fields", () => {
    const candidate = extractWebCandidate({ title: "Example Bridal | Lagos", url: "https://example.com", snippet: "Bridal services" }, { city: "Lagos", country: "NG", category: "wedding" });
    expect(candidate).toMatchObject({ source: "web", name: "Example Bridal", website: "https://example.com", city: "Lagos" });
  });

  it("deduplicates domains and applies the candidate limit", () => {
    const candidates = extractWebCandidates([{ title: "A | Lagos", url: "https://a.example" }, { title: "A | Lagos", url: "https://a.example/about" }, { title: "B | Lagos", url: "https://b.example" }], { city: "Lagos", country: "NG" }, 1);
    expect(candidates).toHaveLength(1);
  });
});