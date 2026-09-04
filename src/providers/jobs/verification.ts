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

export async function verifyEmployer(job: NormalizedJob): Promise<JobVerification> {
  const candidates = [job.applyUrl, job.sourceUrl].filter((value): value is string => Boolean(value));
  const evidence: Array<{ url: string; reason: string }> = [];
  const reasons: string[] = [];
  let companyDomain: string | undefined;
  let score = 0;

  for (const url of Array.from(new Set(candidates))) {
    const page = await fetchPage(url);
    if (!page) continue;
    const host = hostname(url);
    if (!host) continue;
    const text = page.toLowerCase();
    const companyMatch = matchesCompany(job, url);
    const titleMatch = text.includes(job.title.toLowerCase());
    const careersSignal = /\b(careers|career|jobs|job openings|join our team|work with us|vacancies)\b/i.test(text);
    const agencySignal = /\b(staffing agency|recruitment agency|recruiter|on behalf of|headhunt|outsourcing)\b/i.test(text);
    const atsHost = /greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|recruitee\.com|bamboohr\.com|personio\./i.test(host);

    if (companyMatch) { score += 35; evidence.push({ url, reason: "Public source domain matches the named employer." }); companyDomain = host; }
    if (titleMatch) { score += 20; evidence.push({ url, reason: "Public source contains the discovered job title." }); }
    if (careersSignal) { score += 20; evidence.push({ url, reason: "Public source contains an employer careers/jobs context." }); }
    if (agencySignal) { score -= 45; reasons.push("Recruitment or staffing language was found on the source page."); }
    if (atsHost) reasons.push("The posting uses an ATS domain; ATS ownership alone is not treated as employer verification.");
  }

  score = Math.max(0, Math.min(100, score));
  if (score >= 70 && evidence.some((item) => item.reason === "Public source domain matches the named employer.") && !reasons.some((reason) => reason.startsWith("Recruitment"))) {
    return { status: "direct_employer_verified", score, reasons: ["Employer identity and job context were corroborated from a public source.", ...reasons], evidence, companyDomain };
  }
  if (evidence.length || reasons.length) return { status: "needs_verification", score, reasons: reasons.length ? reasons : ["Public source evidence exists, but it is insufficient for direct-employer verification."], evidence, companyDomain };
  return { status: "unverified", score: 0, reasons: ["No accessible public source provided enough evidence to verify employer ownership."], evidence };
}
