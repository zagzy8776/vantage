import type { NormalizedJob } from "./types";

export interface JobVerification {
  status: "unverified" | "needs_verification" | "direct_employer_verified" | "rejected";
  score: number;
  reasons: string[];
  evidence: Array<{ url: string; reason: string }>;
  companyDomain?: string;
}

const ATS_HOSTS = ["greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "recruitee.com", "bamboohr.com", "personio.de", "personio.com"];
function hostname(value?: string) { if (!value) return undefined; try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return undefined; } }
function isAts(value?: string) { const h = hostname(value) ?? ""; return ATS_HOSTS.some((ats) => h === ats || h.endsWith(`.${ats}`)); }
function companyTokens(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 2 && !["the", "and", "ltd", "limited", "llc", "inc", "company", "corp", "corporation", "group", "holdings", "services"].includes(token)); }
function matchesCompany(job: NormalizedJob, url?: string) {
  const host = hostname(url); if (!host || isAts(host)) return false;
  const tokens = companyTokens(job.companyName); const hostText = host.replace(/[^a-z0-9]+/g, " ");
  if (!tokens.length) return false;
  const compactName = job.companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const compactHost = host.replace(/[^a-z0-9]/g, "");
  if (compactName && compactHost.includes(compactName)) return true;
  return tokens.filter((token) => hostText.includes(token)).length >= Math.min(2, tokens.length);
}
function sameHost(left?: string, right?: string) { const a = hostname(left); const b = hostname(right); return Boolean(a && b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`))); }

async function fetchPage(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html,application/xhtml+xml" } });
    if (!response.ok) return undefined;
    const type = response.headers.get("content-type") ?? ""; if (!/text\/html|application\/xhtml\+xml/i.test(type)) return undefined;
    return (await response.text()).slice(0, 250_000);
  } catch { return undefined; }
}

function textFromHtml(value: string) { return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim(); }

/**
 * Provider listing pages are discovery evidence, not employer evidence.
 * Verification only becomes direct-employer verification when a public employer-domain page corroborates the named company and role.
 */
export async function verifyEmployer(job: NormalizedJob): Promise<JobVerification> {
  const employerUrl = job.companyWebsite;
  const employerHost = hostname(employerUrl);
  if (!employerUrl || !employerHost || isAts(employerUrl)) {
    return { status: "unverified", score: 0, reasons: ["The job was discovered, but Vantage does not have a verified public employer website to inspect."], evidence: [] };
  }

  const candidates = Array.from(new Set([employerUrl, job.sourceUrl, job.applyUrl].filter(Boolean) as string[])).filter((url) => {
    const h = hostname(url); return Boolean(h && (sameHost(url, employerUrl) || isAts(url)));
  });
  const evidence: Array<{ url: string; reason: string }> = [{ url: employerUrl, reason: "Public employer website supplied or resolved by Vantage's source-research pipeline." }];
  const reasons: string[] = [];
  let bestScore = 35;
  let publicPageFound = false;
  let companyConfirmed = false;
  let roleConfirmed = false;
  let careersConfirmed = false;
  let agencySignal = false;

  for (const url of candidates) {
    const page = await fetchPage(url); if (!page) continue;
    publicPageFound = true;
    const pageText = textFromHtml(page); const pageLower = pageText.toLowerCase();
    const companyMatch = matchesCompany(job, url) || pageLower.includes(job.companyName.toLowerCase());
    const companyNamePresent = pageLower.includes(job.companyName.toLowerCase());
    const roleMatch = pageLower.includes(job.title.toLowerCase());
    const titleTokens = job.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 2);
    const roleTokenHits = titleTokens.filter((token) => pageLower.includes(token)).length;
    const careerSignal = /\b(careers|career|jobs|job openings|join our team|work with us|vacancies|opportunities)\b/i.test(pageText);
    const agency = /\b(staffing agency|recruitment agency|recruiter|on behalf of|headhunt|outsourcing|staffing firm)\b/i.test(pageText);
    const atsApplication = isAts(url);

    if (companyMatch || companyNamePresent) { companyConfirmed = true; bestScore = Math.max(bestScore, 60); evidence.push({ url, reason: "Public page corroborates the named employer." }); }
    if (roleMatch || roleTokenHits >= Math.max(2, Math.ceil(titleTokens.length * 0.6))) { roleConfirmed = true; bestScore = Math.max(bestScore, 80); evidence.push({ url, reason: "Public page contains the requested job title or strong title-token match." }); }
    if (careerSignal) { careersConfirmed = true; bestScore = Math.max(bestScore, 75); evidence.push({ url, reason: "Public employer page contains a careers/jobs context." }); }
    if (atsApplication && (roleMatch || roleTokenHits >= Math.max(2, Math.ceil(titleTokens.length * 0.6)))) { bestScore = Math.max(bestScore, 70); evidence.push({ url, reason: "Public ATS application page matches the requested role and is connected to the employer research path." }); }
    if (agency) { agencySignal = true; bestScore -= 45; reasons.push("Recruitment or staffing language was found on a researched public page."); }
  }

  if (!publicPageFound) return { status: "needs_verification", score: 0, reasons: ["The employer website was identified, but its public pages could not be reached for verification."], evidence, companyDomain: employerHost };
  if (!companyConfirmed) reasons.push("The public employer-domain pages could not independently corroborate the named company.");
  if (!roleConfirmed) reasons.push("The researched public pages did not clearly contain the requested job title.");
  if (!careersConfirmed) reasons.push("A careers/jobs context was not established on the public employer-domain pages.");
  if (sameHost(job.sourceUrl, employerUrl)) bestScore += 10;
  bestScore = Math.max(0, Math.min(100, bestScore));

  if (bestScore >= 70 && companyConfirmed && (roleConfirmed || careersConfirmed) && !agencySignal) {
    return { status: "direct_employer_verified", score: bestScore, reasons: ["Employer identity and job context were corroborated from public employer-domain evidence.", ...reasons], evidence: Array.from(new Map(evidence.map((item) => [`${item.url}|${item.reason}`, item])).values()).slice(0, 12), companyDomain: employerHost };
  }
  return { status: "needs_verification", score: bestScore, reasons: reasons.length ? reasons : ["Employer evidence exists, but it is insufficient for direct-employer verification."], evidence: Array.from(new Map(evidence.map((item) => [`${item.url}|${item.reason}`, item])).values()).slice(0, 12), companyDomain: employerHost };
}
