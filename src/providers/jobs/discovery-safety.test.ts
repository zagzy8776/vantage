import { describe, expect, it } from "vitest";
import { isAtsUrl, isEmployerUrl, isKnownAggregatorUrl, sanitizeDiscoveredJob } from "./discovery-safety";
import type { NormalizedJob } from "./types";

const baseJob: NormalizedJob = {
  id: "test:1",
  provider: "web_discovery",
  title: "Software Engineer",
  companyName: "Acme",
  companyDomain: "acme.com",
  companyWebsite: "https://acme.com",
  applyUrl: "https://acme.com/careers/software-engineer",
  sourceUrl: "https://acme.com/careers/software-engineer",
  sourceName: "Vantage intelligence",
  verificationStatus: "unverified",
  verificationReasons: [],
};

describe("discovery safety", () => {
  it("recognizes known aggregators", () => {
    expect(isKnownAggregatorUrl("https://www.jobberman.com/jobs/example")).toBe(true);
    expect(isKnownAggregatorUrl("https://acme.com/jobs/example")).toBe(false);
  });

  it("recognizes ATS destinations", () => {
    expect(isAtsUrl("https://jobs.lever.co/acme/software-engineer")).toBe(true);
    expect(isAtsUrl("https://acme.com/careers/software-engineer")).toBe(false);
  });

  it("keeps employer-owned application URLs", () => {
    expect(isEmployerUrl(baseJob, "https://careers.acme.com/jobs/123")).toBe(true);
    expect(sanitizeDiscoveredJob(baseJob).applyUrl).toBe(baseJob.applyUrl);
  });

  it("removes third-party application redirects", () => {
    const job = { ...baseJob, sourceUrl: "https://jobberman.com/job/123", applyUrl: "https://jobberman.com/job/123" };
    const safe = sanitizeDiscoveredJob(job);
    expect(safe.applyUrl).toBeUndefined();
    expect(safe.verificationReasons.join(" ")).toMatch(/third-party publisher URL/i);
  });
});
