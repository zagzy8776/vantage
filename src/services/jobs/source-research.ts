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
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}
function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function links(html: string, baseUrl: string, job: NormalizedJob) {
  const result: Array<{ url: string; score: number }> = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  const titleTokens = normalizeText(job.title).split(" ").filter((token) => token.length > 2);
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1] ?? ""; const label = stripHtml(match[2] ?? "");
    if (!/(apply|job|career|careers|vacanc|opening|opportunit)/i.test(`${label} ${href}`)) continue;
    const url = safeUrl(new URL(href, baseUrl).toString()); if (!url) continue;
    const lower = `${label} ${href}`.toLowerCase(); let score = 0;
    if (/\bapply(?: now| here)?\b/i.test(label)) score += 8;
    if (/\b(job|opening|vacanc|opportunit)\b/i.test(lower)) score += 4;
    const normalized = normalizeText(`${label} ${href}`); score += titleTokens.filter((token) => normalized.includes(token)).length * 2;
    if (ATS_HOSTS.some((ats) => (host(url) ?? "") === ats || (host(url) ?? "").endsWith(`.${ats}`))) score += 2;
    result.push({ url, score });
  }
  return Array.from(new Map(result.map((item) => [item.url, item])).values()).sort((a, b) => b.score - a.score);
}
function companyTokens(name: string) {
  return normalizeText(name).split(" ").filter((x) => x.length > 2 && !["the", "and", "group", "company", "limited", "ltd", "inc", "corp", "corporation", "llc"].includes(x));
}
function companyHostMatch(name: string, url?: string) {
  const h = host(url) ?? ""; const text = h.replace(/[^a-z0-9]+/g, " "); const tokens = companyTokens(name);
  return tokens.length > 0 && tokens.filter((token) => text.includes(token)).length >= Math.min(2, tokens.length);
}
function isBlockedHost(url?: string) {
  const h = host(url) ?? "";
  return BLOCKED_HOSTS.has(h) || Array.from(BLOCKED_HOSTS).some((blocked) => h.endsWith(`.${blocked}`));
}
function scoreResult(job: NormalizedJob, item: { title: string; url: string; snippet?: string }) {
  if (isBlockedHost(item.url)) return 0;
  const title = `${item.title} ${item.snippet ?? ""}`.toLowerCase(); const tokens = companyTokens(job.companyName);
  const nameHits = tokens.filter((token) => title.includes(token)).length; const exactName = title.includes(job.companyName.toLowerCase()); const titleMatch = title.includes(job.title.toLowerCase());
  const careerSignal = /\b(careers?|jobs?|vacancies|openings|join our team)\b/i.test(title) || /\/careers?\b|\/jobs?\b|\/vacanc/i.test(item.url);
  if (!exactName && nameHits < Math.min(2, tokens.length)) return 0;
  let score = nameHits * 3 + (exactName ? 8 : 0) + (titleMatch ? 10 : 0) + (careerSignal ? 5 : 0);
  if (companyHostMatch(job.companyName, item.url)) score += 12;
  if (ATS_HOSTS.some((ats) => (host(item.url) ?? "") === ats || (host(item.url) ?? "").endsWith(`.${ats}`))) score += 2;
  return score;
}
async function fetchPublic(url: string) {
  try {
    const response = await fetch(url, { headers: { Accept: "text/html,application/xhtml+xml" }, cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return undefined;
    const type = response.headers.get("content-type") ?? ""; if (!/text\/html|application\/xhtml\+xml/i.test(type)) return undefined;
    return (await response.text()).slice(0, 500_000);
  } catch { return undefined; }
}
function extractDescription(html: string) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html;
  return stripHtml(main).slice(0, 30_000);
}
function jobTextMatch(text: string, job: NormalizedJob) {
  const lower = text.toLowerCase(); if (lower.includes(job.title.toLowerCase())) return true;
  const titleTokens = normalizeText(job.title).split(" ").filter((token) => token.length > 2); const titleHits = titleTokens.filter((token) => lower.includes(token)).length;
  return titleTokens.length > 0 && titleHits >= Math.max(2, Math.ceil(titleTokens.length * 0.6));
}
function bestEmployerUrl(job: NormalizedJob, url: string) { return companyHostMatch(job.companyName, url) ? url : job.companyWebsite; }

async function searchCandidates(job: NormalizedJob, location: string) {
  const queries = [
    `"${job.companyName}" "${job.title}" ${location} careers jobs apply`,
    `"${job.companyName}" ${job.title} careers`,
    `"${job.companyName}" jobs ${location}`,
  ];
  const all: Array<{ title: string; url: string; snippet?: string }> = [];
  for (const query of queries) {
    try {
      const search = await searchEvidence({ businessName: job.companyName, location, country: job.countryCode, category: "employment", limit: 10, query }, "both");
      all.push(...search.results.flatMap((result) => result.results));
    } catch { /* one search provider failure should not discard the job */ }
    const ranked = all.map((item) => ({ item, score: scoreResult(job, item) })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
    if (ranked.length >= 3) return ranked.slice(0, 8);
  }
  return all.map((item) => ({ item, score: scoreResult(job, item) })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
}

export async function researchJobSource(job: NormalizedJob): Promise<NormalizedJob> {
  const location = job.location ?? [job.city, job.countryCode].filter(Boolean).join(", ");
  const seedUrls = Array.from(new Set([safeUrl(job.sourceUrl), safeUrl(job.applyUrl), safeUrl(job.companyWebsite)].filter(Boolean) as string[]));
  let best = job; let researchedText = "";

  for (const seed of seedUrls) {
    if (isBlockedHost(seed)) continue;
    const page = await fetchPublic(seed); if (!page) continue;
    const pageText = extractDescription(page); const lower = pageText.toLowerCase();
    const employerMatch = companyHostMatch(job.companyName, seed) || lower.includes(job.companyName.toLowerCase()); const titleMatch = jobTextMatch(pageText, job);
    if (!employerMatch && !titleMatch) continue;
    researchedText = pageText.length > researchedText.length ? pageText : researchedText;
    const candidates = links(page, seed, job); const sourceHost = host(seed);
    const application = candidates.find((candidate) => {
      const candidateHost = host(candidate.url) ?? ""; const sameEmployer = Boolean(sourceHost && (candidateHost === sourceHost || candidateHost.endsWith(`.${sourceHost}`)));
      const ats = ATS_HOSTS.some((atsHost) => candidateHost === atsHost || candidateHost.endsWith(`.${atsHost}`));
      return sameEmployer || ats;
    })?.url;
    const employerWebsite = bestEmployerUrl(job, seed);
    best = { ...best, companyWebsite: employerWebsite ?? best.companyWebsite, companyDomain: host(employerWebsite) ?? best.companyDomain, sourceUrl: seed, applyUrl: application ?? best.applyUrl, description: pageText.length > (best.description?.length ?? 0) ? pageText : best.description, verificationReasons: [...new Set([...best.verificationReasons, "Public source research matched the named employer and role."])] };
    if (application || best.companyWebsite) break;
  }

  if (!best.applyUrl || !best.companyWebsite || researchedText.length < 400) {
    const ranked = await searchCandidates(job, location);
    for (const candidate of ranked) {
      const url = safeUrl(candidate.item.url); if (!url || isBlockedHost(url)) continue;
      const page = await fetchPublic(url); if (!page) continue;
      const pageText = extractDescription(page); const pageLower = pageText.toLowerCase();
      const employerMatch = companyHostMatch(job.companyName, url) || pageLower.includes(job.companyName.toLowerCase()); const titleMatch = jobTextMatch(pageText, job);
      if (!employerMatch || !titleMatch) continue;
      const candidateLinks = links(page, url, job); const sourceHost = host(url);
      const application = candidateLinks.find((link) => {
        const h = host(link.url) ?? ""; const sameEmployer = h === sourceHost || h.endsWith(`.${sourceHost ?? ""}`); const ats = ATS_HOSTS.some((atsHost) => h === atsHost || h.endsWith(`.${atsHost}`));
        return sameEmployer || ats;
      })?.url;
      const employerWebsite = bestEmployerUrl(job, url);
      best = { ...best, companyWebsite: employerWebsite ?? best.companyWebsite, companyDomain: host(employerWebsite) ?? best.companyDomain, sourceUrl: url, applyUrl: application ?? best.applyUrl, description: pageText.length > (best.description?.length ?? 0) ? pageText : best.description, verificationReasons: [...new Set([...best.verificationReasons, "Public web research found a job page matching the named company, role, and location context."])] };
      if (application || employerWebsite) break;
    }
  }

  try {
    const verification = await verifyEmployer(best);
    return { ...best, companyDomain: verification.companyDomain ?? best.companyDomain, verificationStatus: verification.status, verificationScore: verification.score, verificationReasons: verification.reasons, verificationEvidence: verification.evidence };
  } catch { return best; }
}

export async function researchJobs(jobs: NormalizedJob[], maxJobs = Number(process.env.JOB_SOURCE_RESEARCH_LIMIT) || 20) {
  const selected = jobs.slice(0, Math.max(0, Math.min(maxJobs, jobs.length))); const results = new Map<string, NormalizedJob>(); const queue = [...selected];
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
