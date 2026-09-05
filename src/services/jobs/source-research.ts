import type { JobContactEvidence, NormalizedJob } from "@/providers/jobs/types";
import { searchEvidence } from "@/providers/evidence-search/router";
import { firecrawlWebsiteResearchProvider } from "@/providers/website-research/firecrawl";
import { verifyEmployer } from "@/providers/jobs/verification";

const BLOCKED_HOSTS = new Set(["adzuna.com", "indeed.com", "linkedin.com", "glassdoor.com", "ziprecruiter.com", "monster.com", "jooble.org", "simplyhired.com", "talent.com", "careerbuilder.com", "jobrapido.com"]);
const ATS_HOSTS = ["greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "recruitee.com", "bamboohr.com", "personio.de", "personio.com"];
const robotsCache = new Map<string, string[] | null>();

function host(url?: string) { try { return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : undefined; } catch { return undefined; } }
function safeUrl(value?: string) { try { const url = new URL(value ?? ""); if (!["http:", "https:"].includes(url.protocol)) return undefined; const h = url.hostname.toLowerCase(); if (h === "localhost" || h.endsWith(".local") || /^127\.|^10\.|^192\.168\.|^169\.254\./.test(h) || /^::1$|^fc|^fd/i.test(h)) return undefined; return url.toString(); } catch { return undefined; } }
function stripHtml(value: string) { return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&#x2F;/gi, "/").replace(/\s+/g, " ").trim(); }
function normalizeText(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function companyTokens(name: string) { return normalizeText(name).split(" ").filter((x) => x.length > 2 && !["the", "and", "group", "company", "limited", "ltd", "inc", "corp", "corporation", "llc", "holdings", "services"].includes(x)); }
function isAtsHost(value?: string) { const h = host(value) ?? ""; return ATS_HOSTS.some((ats) => h === ats || h.endsWith(`.${ats}`)); }
function companyHostMatch(name: string, url?: string) {
  const h = host(url) ?? "";
  if (!h || isAtsHost(h)) return false;
  const text = h.replace(/[^a-z0-9]+/g, " ");
  const tokens = companyTokens(name);
  if (!tokens.length) return false;
  if (normalizeText(name).replace(/ /g, "") === h.replace(/[^a-z0-9]/g, "")) return true;
  return tokens.filter((token) => text.includes(token)).length >= Math.min(2, tokens.length);
}
function isBlockedHost(url?: string) { const h = host(url) ?? ""; return BLOCKED_HOSTS.has(h) || Array.from(BLOCKED_HOSTS).some((blocked) => h.endsWith(`.${blocked}`)); }

async function robotsRules(targetUrl: string) {
  const targetHost = host(targetUrl);
  if (!targetHost) return null;
  if (robotsCache.has(targetHost)) return robotsCache.get(targetHost) ?? null;
  try {
    const response = await fetch(`https://${targetHost}/robots.txt`, { cache: "no-store", signal: AbortSignal.timeout(5_000), headers: { Accept: "text/plain" } });
    if (!response.ok) { robotsCache.set(targetHost, null); return null; }
    const text = await response.text();
    const rules: string[] = [];
    let applies = false;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.split("#", 1)[0].trim();
      if (!line) continue;
      const [keyRaw, valueRaw] = line.split(":", 2);
      const key = keyRaw?.trim().toLowerCase();
      const value = valueRaw?.trim() ?? "";
      if (key === "user-agent") applies = value === "*";
      else if (key === "disallow" && applies && value) rules.push(value);
    }
    robotsCache.set(targetHost, rules);
    return rules;
  } catch { robotsCache.set(targetHost, null); return null; }
}

async function robotsAllowed(targetUrl: string) {
  const rules = await robotsRules(targetUrl);
  if (!rules?.length) return true;
  try {
    const url = new URL(targetUrl);
    return !rules.some((rule) => {
      if (rule === "/") return true;
      return url.pathname.startsWith(rule);
    });
  } catch { return false; }
}

function links(html: string, baseUrl: string, job: NormalizedJob) {
  const result: Array<{ url: string; score: number; label: string }> = [];
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
    if (isAtsHost(url)) score += 2;
    result.push({ url, score, label });
  }
  return Array.from(new Map(result.map((item) => [item.url, item])).values()).sort((a, b) => b.score - a.score);
}

function supportingLinks(html: string, baseUrl: string) {
  const result: Array<{ url: string; score: number; label: string }> = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1] ?? ""; const label = stripHtml(match[2] ?? "");
    if (!/(contact|about|team|people|career|careers|jobs|vacanc|opening|opportunit)/i.test(`${label} ${href}`)) continue;
    const url = safeUrl(new URL(href, baseUrl).toString()); if (!url || isBlockedHost(url)) continue;
    let score = 0; if (/contact/i.test(`${label} ${href}`)) score += 8; if (/career|jobs?|vacanc|opening/i.test(`${label} ${href}`)) score += 5; if (/about|team|people/i.test(`${label} ${href}`)) score += 2;
    result.push({ url, score, label });
  }
  return Array.from(new Map(result.map((item) => [item.url, item])).values()).sort((a, b) => b.score - a.score).slice(0, 8);
}

function employerLinks(html: string, baseUrl: string, job: NormalizedJob) {
  const result: Array<{ url: string; score: number }> = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  const tokens = companyTokens(job.companyName);
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1] ?? ""; const label = stripHtml(match[2] ?? ""); const url = safeUrl(new URL(href, baseUrl).toString());
    if (!url || isBlockedHost(url) || isAtsHost(url) || !companyHostMatch(job.companyName, url)) continue;
    const normalized = normalizeText(`${label} ${url}`); const hits = tokens.filter((token) => normalized.includes(token)).length;
    result.push({ url, score: hits * 4 + (label.toLowerCase().includes(job.companyName.toLowerCase()) ? 8 : 0) });
  }
  return Array.from(new Map(result.map((item) => [item.url, item])).values()).sort((a, b) => b.score - a.score).slice(0, 5).map((item) => item.url);
}

function scoreResult(job: NormalizedJob, item: { title: string; url: string; snippet?: string }) {
  if (isBlockedHost(item.url) || isAtsHost(item.url)) return 0;
  const title = `${item.title} ${item.snippet ?? ""}`.toLowerCase(); const tokens = companyTokens(job.companyName); const nameHits = tokens.filter((token) => title.includes(token)).length;
  const exactName = title.includes(job.companyName.toLowerCase()); const titleMatch = title.includes(job.title.toLowerCase()); const careerSignal = /\b(careers?|jobs?|vacancies|openings|join our team)\b/i.test(title) || /\/careers?\b|\/jobs?\b|\/vacanc/i.test(item.url);
  if (!exactName && nameHits < Math.min(2, tokens.length)) return 0;
  let score = nameHits * 3 + (exactName ? 8 : 0) + (titleMatch ? 10 : 0) + (careerSignal ? 5 : 0); if (companyHostMatch(job.companyName, item.url)) score += 14; return score;
}

async function fetchPublic(url: string) {
  const safe = safeUrl(url); if (!safe || isBlockedHost(safe)) return undefined;
  if (!(await robotsAllowed(safe))) return undefined;
  try {
    const response = await fetch(safe, { headers: { Accept: "text/html,application/xhtml+xml" }, cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return undefined;
    const type = response.headers.get("content-type") ?? ""; if (!/text\/html|application\/xhtml\+xml/i.test(type)) return undefined;
    return (await response.text()).slice(0, 500_000);
  } catch { return undefined; }
}

function extractDescription(html: string) { const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html; return stripHtml(main).slice(0, 30_000); }
function jobTextMatch(text: string, job: NormalizedJob) { const lower = text.toLowerCase(); if (lower.includes(job.title.toLowerCase())) return true; const titleTokens = normalizeText(job.title).split(" ").filter((token) => token.length > 2); const titleHits = titleTokens.filter((token) => lower.includes(token)).length; return titleTokens.length > 0 && titleHits >= Math.max(2, Math.ceil(titleTokens.length * 0.6)); }
function bestEmployerUrl(job: NormalizedJob, url: string) { if (companyHostMatch(job.companyName, url)) return url; return job.companyWebsite && !isAtsHost(job.companyWebsite) ? job.companyWebsite : undefined; }

function extractContacts(html: string, pageUrl: string, job: NormalizedJob): { phone?: string; email?: string; contactUrl?: string; evidence: JobContactEvidence[] } {
  if (!companyHostMatch(job.companyName, pageUrl)) return { evidence: [] };
  const pageHost = host(pageUrl); if (!pageHost) return { evidence: [] };
  const evidence: JobContactEvidence[] = [];
  const emails = new Set<string>(); const phones = new Set<string>();
  const mailtoPattern = /href=["']mailto:([^"'? >]+)/gi; let mailMatch: RegExpExecArray | null;
  while ((mailMatch = mailtoPattern.exec(html)) !== null) emails.add(mailMatch[1].trim().toLowerCase());
  const textContent = stripHtml(html);
  for (const match of textContent.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) emails.add(match[0].toLowerCase());
  for (const email of emails) {
    const domain = email.split("@")[1] ?? "";
    if (domain === pageHost || domain.endsWith(`.${pageHost}`)) evidence.push({ value: email, url: pageUrl, reason: "Public employer-domain email published on the employer website." });
  }
  const telPattern = /href=["']tel:([^"']+)["']/gi; let telMatch: RegExpExecArray | null;
  while ((telMatch = telPattern.exec(html)) !== null) phones.add(telMatch[1].replace(/[^\d+]/g, ""));
  for (const match of textContent.matchAll(/(?:\+?\d[\d\s().-]{6,}\d)/g)) phones.add(match[0].replace(/\s+/g, " ").trim());
  for (const phone of phones) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) evidence.push({ value: phone, url: pageUrl, reason: "Public phone number published on the employer website." });
  }
  const contactUrl = supportingLinks(html, pageUrl).find((item) => /contact/i.test(`${item.label} ${item.url}`))?.url;
  return { phone: evidence.find((item) => /phone/i.test(item.reason))?.value, email: evidence.find((item) => /email/i.test(item.reason))?.value, contactUrl, evidence: evidence.slice(0, 8) };
}

async function firecrawlEvidence(job: NormalizedJob, url?: string) {
  if (!url || !process.env.FIRECRAWL_API_KEY?.trim() || isBlockedHost(url) || isAtsHost(url)) return false;
  try {
    const result = await firecrawlWebsiteResearchProvider.research({ businessId: job.id, url, maxPages: Math.min(Number(process.env.JOB_FIRECRAWL_MAX_PAGES) || 3, 5) });
    return result.pagesFetched.length > 0 && result.evidence.length > 0;
  } catch { return false; }
}

async function searchCandidates(job: NormalizedJob, location: string) {
  const queries = [
    `"${job.companyName}" "${job.title}" ${location} official careers apply`,
    `"${job.companyName}" "${job.title}" official employer`,
    `"${job.companyName}" careers ${location}`,
  ];
  const all: Array<{ title: string; url: string; snippet?: string }> = [];
  for (const query of queries) {
    try { const search = await searchEvidence({ businessName: job.companyName, location, country: job.countryCode, category: "employment", limit: 10, query }, "both"); all.push(...search.results.flatMap((result) => result.results)); } catch { /* preserve other search paths */ }
    const ranked = all.map((item) => ({ item, score: scoreResult(job, item) })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
    if (ranked.length >= 3) return ranked.slice(0, 8);
  }
  return all.map((item) => ({ item, score: scoreResult(job, item) })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
}

async function enrichFromPage(best: NormalizedJob, url: string) {
  const page = await fetchPublic(url); if (!page) return best;
  const pageText = extractDescription(page); const pageLower = pageText.toLowerCase();
  const employerMatch = companyHostMatch(best.companyName, url) || pageLower.includes(best.companyName.toLowerCase());
  const titleMatch = jobTextMatch(pageText, best);
  if (!employerMatch || !titleMatch) return best;
  const applicationCandidates = links(page, url, best);
  const sourceHost = host(url);
  const application = applicationCandidates.find((candidate) => {
    const h = host(candidate.url) ?? ""; const sameEmployer = Boolean(sourceHost && (h === sourceHost || h.endsWith(`.${sourceHost}`))); const ats = isAtsHost(h); return sameEmployer || ats;
  })?.url;
  const discoveredEmployer = employerLinks(page, url, best)[0];
  const employerWebsite = bestEmployerUrl(best, url) ?? discoveredEmployer;
  const contacts = employerWebsite && companyHostMatch(best.companyName, employerWebsite) ? extractContacts(page, url, best) : { evidence: [] };
  const firecrawled = await firecrawlEvidence(best, employerWebsite);
  return {
    ...best,
    companyWebsite: employerWebsite ?? best.companyWebsite,
    companyDomain: host(employerWebsite) ?? best.companyDomain,
    sourceUrl: url,
    applyUrl: application ?? best.applyUrl,
    description: pageText.length > (best.description?.length ?? 0) ? pageText : best.description,
    companyPhone: contacts.phone ?? best.companyPhone,
    companyEmail: contacts.email ?? best.companyEmail,
    companyContactUrl: contacts.contactUrl ?? best.companyContactUrl,
    companyContactEvidence: contacts.evidence.length ? contacts.evidence : best.companyContactEvidence,
    verificationReasons: [...new Set([
      ...best.verificationReasons,
      "Public source research matched the named employer and role.",
      ...(discoveredEmployer ? ["The public source linked to a company-domain page matching the named employer."] : []),
      ...(contacts.evidence.length ? ["Public employer contact details were found on the employer domain."] : []),
      ...(firecrawled ? ["Firecrawl independently crawled the public employer source and returned evidence."] : []),
    ])],
  };
}

export async function researchJobSource(job: NormalizedJob): Promise<NormalizedJob> {
  const location = job.location ?? [job.city, job.countryCode].filter(Boolean).join(", ");
  const seedUrls = Array.from(new Set([safeUrl(job.sourceUrl), safeUrl(job.applyUrl), safeUrl(job.companyWebsite)].filter(Boolean) as string[]));
  let best = job;
  let researchedText = "";

  for (const seed of seedUrls) {
    if (isBlockedHost(seed)) continue;
    const enriched = await enrichFromPage(best, seed);
    if (enriched === best) continue;
    researchedText = Math.max(researchedText.length, enriched.description?.length ?? 0) === enriched.description?.length ? enriched.description ?? researchedText : researchedText;
    best = enriched;
    if (best.applyUrl && best.companyWebsite && (best.companyPhone || best.companyEmail)) break;
  }

  if (!best.applyUrl || !best.companyWebsite || researchedText.length < 400 || (!best.companyPhone && !best.companyEmail)) {
    const ranked = await searchCandidates(job, location);
    for (const candidate of ranked) {
      const url = safeUrl(candidate.item.url); if (!url || isBlockedHost(url) || isAtsHost(url)) continue;
      const enriched = await enrichFromPage(best, url);
      if (enriched === best) continue;
      researchedText = Math.max(researchedText.length, enriched.description?.length ?? 0) === enriched.description?.length ? enriched.description ?? researchedText : researchedText;
      best = enriched;
      if (best.applyUrl && best.companyWebsite && (best.companyPhone || best.companyEmail)) break;
    }
  }

  try {
    const verification = await verifyEmployer(best);
    return {
      ...best,
      companyDomain: verification.companyDomain ?? best.companyDomain,
      verificationStatus: verification.status,
      verificationScore: verification.score,
      verificationReasons: verification.reasons,
      verificationEvidence: [
        ...verification.evidence,
        ...(best.companyContactEvidence ?? []).map((item) => ({ url: item.url, reason: item.reason })),
      ],
    };
  } catch { return best; }
}

export async function researchJobs(jobs: NormalizedJob[], maxJobs = jobs.length) {
  const selected = jobs.slice(0, Math.max(0, Math.min(maxJobs, jobs.length)));
  const results = new Map<string, NormalizedJob>(); const queue = [...selected];
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
