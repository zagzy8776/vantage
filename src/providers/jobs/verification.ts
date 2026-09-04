import type { NormalizedJob } from "./types";

export interface JobVerification {
  status: "unverified" | "needs_verification" | "direct_employer_verified" | "rejected";
  score: number;
  reasons: string[];
  evidence: Array<{ url: string; reason: string }>;
  companyDomain?: string;
}

function hostname(value?: string) {
  if (!value) return undefined;
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return undefined; }
}

function companyTokens(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 2 && !["the", "and", "ltd", "limited", "llc", "inc", "company", "corp", "corporation", "group"].includes(token));
}

function matchesCompany(job: NormalizedJob, url?: string) {
  const host = hostname(url);
  if (!host) return false;
  const tokens = companyTokens(job.companyName);
  const hostText = host.replace(/[^a-z0-9]+/g, " ");
  return tokens.length > 0 && tokens.filter((token) => hostText.includes(token)).length >= Math.min(2, tokens.length);
}

async function fetchPage(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html,application/xhtml+xml" } });
    if (!response.ok) return undefined;
    return (await response.text()).slice(0, 250_000);
  } catch { return undefined; }
}

/**
 * Provider listing pages are discovery evidence, not employer evidence.
 * Never fetch Adzuna/JSearch/JobsPipe/Hirebase/TheirStack pages here.
 * Only a supplied employer website is eligible for public-page verification.
 */
export async function verifyEmployer(job: NormalizedJob): Promise<JobVerification> {
  const employerUrl = job.companyWebsite;
  const employerHost = hostname(employerUrl);
  if (!employerUrl || !employerHost) {
    return {
      status: "unverified",
      score: 0,
      reasons: ["The job was discovered, but Vantage does not have a verified public employer website to inspect."],
      evidence: [],
    };
  }

  const page = await fetchPage(employerUrl);
  if (!page) {
    return {
      status: "needs_verification",
      score: 0,
      reasons: ["The employer website was identified, but its public page could not be reached for verification."],
      evidence: [{ url: employerUrl, reason: "Employer website supplied by the job source." }],
      companyDomain: employerHost,
    };
  }

  const pageText = page.toLowerCase();
  const evidence: Array<{ url: string; reason: string }> = [{ url: employerUrl, reason: "Public employer website supplied by the job source." }];
  const reasons: string[] = [];
  let score = 35;

  const companyMatch = matchesCompany(job, employerUrl);
  const companyNameLower = job.companyName.toLowerCase();
  const companyNamePresent = pageText.includes(companyNameLower);
  const careersSignal = /\b(careers|career|jobs|job openings|join our team|work with us|vacancies)\b/i.test(pageText);
  const agencySignal = /\b(staffing agency|recruitment agency|recruiter|on behalf of|headhunt|outsourcing)\b/i.test(pageText);

  if (companyMatch || companyNamePresent) {
    score += 25;
    evidence.push({ url: employerUrl, reason: "Public employer website corroborates the named company." });
  } else {
    reasons.push("The employer website could not independently corroborate the named company.");
  }
  if (careersSignal) {
    score += 20;
    evidence.push({ url: employerUrl, reason: "Public employer website contains a careers/jobs context." });
  }
  if (agencySignal) {
    score -= 45;
    reasons.push("Recruitment or staffing language was found on the employer-domain page.");
  }

  score = Math.max(0, Math.min(100, score));
  if (score >= 70 && (companyMatch || companyNamePresent) && !agencySignal) {
    return {
      status: "direct_employer_verified",
      score,
      reasons: ["Employer identity was corroborated from the public employer website.", ...reasons],
      evidence,
      companyDomain: employerHost,
    };
  }

  return {
    status: "needs_verification",
    score,
    reasons: reasons.length ? reasons : ["Employer evidence exists, but it is insufficient for direct-employer verification."],
    evidence,
    companyDomain: employerHost,
  };
}
