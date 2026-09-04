import type { NormalizedJob } from "@/providers/jobs/types";
import { searchEvidence } from "@/providers/evidence-search/router";
import { verifyEmployer } from "@/providers/jobs/verification";

const BLOCKED_HOSTS = new Set(["adzuna.com", "indeed.com", "linkedin.com", "glassdoor.com", "ziprecruiter.com", "monster.com", "jooble.org", "simplyhired.com", "talent.com", "careerbuilder.com", "jobrapido.com"]);
const ATS_HOSTS = ["greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "recruitee.com", "bamboohr.com", "personio."];

function host(url?: string) {
  try { return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : undefined; } catch { return undefined; }
}
function safeUrl(value?: string) {
  try {
    const url = new URL(value ?? "");
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    const h = url.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || /^127\.|^10\.|^192\.168\.|^169\.254\./.test(h)) return undefined;
    return url.toString();
  } catch { return undefined; }
}
function stripHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}
function links(html: string, baseUrl: string) {
  const result: string[] = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const label = stripHtml(match[2] ?? "");
    if (!/(apply|apply now|job|career|careers|vacanc|opening|opportunit)/i.test(`${label} ${match[1]}`)) continue;
    const url = safeUrl(new URL(match[1], baseUrl).toString());
    if (url) result.push(url);
  }
  return Array.from(new Set(result));
}
function companyTokens(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((x) => x.length > 2 && !["the", "and", "group", "company", "limited", "ltd", "inc", "corp", "corporation"].includes(x));
}
function companyHostMatch(name: string, url?: string) {
  const h = host(url) ?? ""; const text = h.replace(/[^a-z0-9]+/g, " "); const tokens = companyTokens(name);
  return tokens.length > 0 && tokens.filter((token) => text.includes(token)).length >= Math.min(2, tokens.length);
}
function scoreResult(job: NormalizedJob, item: { title: string; url: string; snippet?: string }) {
  const h = host(item.url) ?? "";
  if (BLOCKED_HOSTS.has(h) || Array.from(BLOCKED_HOSTS).some((blocked) => h.endsWith(`.${blocked}`))) return 0;
  const title = `${item.title} ${item.snippet ?? ""}`.toLowerCase();
  const tokens = companyTokens(job.companyName);
  const nameHits = tokens.filter((token) => title.includes(token)).length;
  const exactName = title.includes(job.companyName.toLowerCase());
  const titleMatch = title.includes(job.title.toLowerCase());
  const careerSignal = /\b(careers?|jobs?|vacancies|openings|join our team)\b/i.test(title) || /\/careers?\b|\/jobs?\b|\/vacanc/i.test(item.url);
  if (!exactName && nameHits < Math.min(2, tokens.length)) return 0;
  let score = nameHits * 3 + (exactName ? 8 : 0) + (titleMatch ? 8 : 0) + (careerSignal ? 5 : 0);
  if (ATS_HOSTS.some((ats) => h === ats || h.endsWith(`.${ats}`))) score += 2;
  return score;
}
async function fetchPublic(url: string) {
  try {
    const response = await fetch(url, { headers: { Accept: "text/html,application/xhtml+xml" }, cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return undefined;
    const type = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) return undefined;
    return (await response.text()).slice(0, 500_000);
  } catch { return undefined; }
}
function extractDescription(html: string) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html;
  return stripHtml(main).slice(0, 30_000);
}

export async function researchJobSource(job: NormalizedJob): Promise<NormalizedJob> {
  const location = job.location ?? [job.city, job.countryCode].filter(Boolean).join(", ");
  const search = await searchEvidence({
    businessName: job.companyName,
    location,
    country: job.countryCode,
    category: "employment",
    limit: 10,
    query: `"${job.companyName}" "${job.title}" ${location} careers jobs apply`,
  }, "both");
  const items = search.results.flatMap((result) => result.results);
  const ranked = items.map((item) => ({ item, score: scoreResult(job, item) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);

  let best = job;
  for (const candidate of ranked) {
    const url = safeUrl(candidate.item.url); if (!url) continue;
    const page = await fetchPublic(url); if (!page) continue;
    const pageText = extractDescription(page);
    const pageLower = pageText.toLowerCase();
    const employerMatch = companyHostMatch(job.companyName, url) || pageLower.includes(job.companyName.toLowerCase());
    const jobMatch = pageLower.includes(job.title.toLowerCase());
    if (!employerMatch && !jobMatch) continue;

    const candidateLinks = links(page, url);
    const directApply = candidateLinks.find((link) => {
      const h = host(link) ?? "";
      const sameEmployer = h === host(url) || h.endsWith(`.${host(url) ?? ""}`);
      const ats = ATS_HOSTS.some((item) => h === item || h.endsWith(`.${item}`));
      return sameEmployer || ats;
    });
    const employerWebsite = companyHostMatch(job.companyName, url) ? url : best.companyWebsite;
    const improvedDescription = pageText.length > (job.description?.length ?? 0) ? pageText : job.description;
    best = {
      ...best,
      companyWebsite: employerWebsite ?? best.companyWebsite,
      companyDomain: host(employerWebsite) ?? best.companyDomain,
      sourceUrl: url,
      applyUrl: directApply ?? best.applyUrl,
      description: improvedDescription,
      verificationReasons: [...new Set([...best.verificationReasons, "Public web research found a job/employer page matching the named company and role."])],
    };
    if (directApply || employerWebsite) break;
  }

  try {
    const verification = await verifyEmployer(best);
    return { ...best, companyDomain: verification.companyDomain ?? best.companyDomain, verificationStatus: verification.status, verificationScore: verification.score, verificationReasons: verification.reasons, verificationEvidence: verification.evidence };
  } catch {
    return best;
  }
}

export async function researchJobs(jobs: NormalizedJob[], maxJobs = Number(process.env.JOB_SOURCE_RESEARCH_LIMIT) || 20) {
  const selected = jobs.slice(0, Math.max(0, Math.min(maxJobs, jobs.length)));
  const results = new Map<string, NormalizedJob>();
  const queue = [...selected];
  const concurrency = Math.max(1, Math.min(Number(process.env.JOB_SOURCE_RESEARCH_CONCURRENCY) || 3, 5));
  async function worker() {
    while (queue.length) {
      const job = queue.shift(); if (!job) return;
      try { results.set(job.id, await researchJobSource(job)); } catch { results.set(job.id, job); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));
  return jobs.map((job) => results.get(job.id) ?? job);
}
