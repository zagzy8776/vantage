import type { JobContactEvidence, NormalizedJob } from "@/providers/jobs/types";
import { searchEvidence } from "@/providers/evidence-search/router";
import { verifyEmployer } from "@/providers/jobs/verification";

const ATS_HOSTS = ["greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "recruitee.com", "bamboohr.com", "personio.de", "personio.com", "workday.com", "myworkdayjobs.com", "icims.com", "jobvite.com", "teamtailor.com", "workable.com"];
const BLOCKED_HOSTS = ["adzuna.com", "indeed.com", "linkedin.com", "glassdoor.com", "ziprecruiter.com", "monster.com", "jooble.org", "simplyhired.com", "talent.com", "careerbuilder.com", "jobrapido.com"];

type SearchItem = { title: string; url: string; snippet?: string; metadata?: Record<string, unknown> };
type FirecrawlResult = { url?: string; markdown?: string; html?: string; links?: string[]; metadata?: Record<string, unknown> };

function cleanUrl(value: unknown) { try { const url = new URL(String(value)); if (!["http:", "https:"].includes(url.protocol)) return undefined; const host = url.hostname.toLowerCase(); if (host === "localhost" || host.endsWith(".local") || /^127\.|^10\.|^192\.168\.|^169\.254\./.test(host)) return undefined; return url.toString(); } catch { return undefined; } }
function host(value?: string) { try { return value ? new URL(value).hostname.toLowerCase().replace(/^www\./, "") : undefined; } catch { return undefined; } }
function blocked(value?: string) { const h = host(value) ?? ""; return BLOCKED_HOSTS.some((x) => h === x || h.endsWith(`.${x}`)); }
function ats(value?: string) { const h = host(value) ?? ""; return ATS_HOSTS.some((x) => h === x || h.endsWith(`.${x}`)); }
function norm(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function tokens(value: string) { return norm(value).split(" ").filter((x) => x.length > 2 && !["the", "and", "group", "company", "limited", "ltd", "inc", "corp", "corporation", "llc", "holdings", "services"].includes(x)); }
function companyMatches(name: string, url?: string) { const h = host(url) ?? ""; if (!h || ats(url)) return false; const compact = norm(name).replace(/ /g, ""); const hostCompact = h.replace(/[^a-z0-9]/g, ""); if (compact && hostCompact.includes(compact)) return true; const parts = tokens(name); return parts.length > 0 && parts.filter((part) => h.includes(part)).length >= Math.min(2, parts.length); }
function titleMatches(title: string, text: string) { const source = norm(text); const exact = source.includes(norm(title)); const parts = tokens(title); const hits = parts.filter((part) => source.includes(part)).length; return { exact, score: exact ? 30 : hits >= Math.max(2, Math.ceil(parts.length * 0.55)) ? hits * 4 : 0 }; }
function companyScore(name: string, item: SearchItem) { if (blocked(item.url)) return 0; const text = norm(`${item.title} ${item.snippet ?? ""}`); const exact = text.includes(norm(name)); const hits = tokens(name).filter((part) => text.includes(part)).length; const hostMatch = companyMatches(name, item.url); if (!exact && !hostMatch && hits < Math.min(2, tokens(name).length)) return 0; return (exact ? 30 : hits * 5) + (hostMatch ? 35 : 0) + (/\b(official|contact|about|careers?|jobs?)\b/i.test(text) ? 8 : 0); }
function jobScore(job: NormalizedJob, item: SearchItem) { if (blocked(item.url)) return 0; const text = `${item.title} ${item.snippet ?? ""}`; const c = companyScore(job.companyName, item); const t = titleMatches(job.title, text); if (!c || !t.score) return 0; return c + t.score + (ats(item.url) ? 12 : 0) + (companyMatches(job.companyName, item.url) ? 20 : 0); }

function extractLinks(html: string, baseUrl: string) { const links = new Set<string>(); const pattern = /(?:href|url)=["']([^"']+)["']/gi; let match: RegExpExecArray | null; while ((match = pattern.exec(html)) !== null) { const url = cleanUrl(new URL(match[1], baseUrl).toString()); if (url && !blocked(url)) links.add(url); } for (const raw of html.match(/https?:\/\/[^\s<>"')]+/gi) ?? []) { const url = cleanUrl(raw); if (url && !blocked(url)) links.add(url); } return Array.from(links); }
function linkScore(job: NormalizedJob, url: string) { const lower = url.toLowerCase(); const title = norm(job.title); let score = 0; if (/apply|application/.test(lower)) score += 35; if (/career|jobs?|vacanc|opening|opportunit/.test(lower)) score += 20; if (ats(url)) score += 25; if (companyMatches(job.companyName, url)) score += 25; for (const part of tokens(job.title)) if (norm(lower).includes(part)) score += 3; if (/\/(contact|about|team|people)(\/|$)/i.test(new URL(url).pathname)) score -= 5; return score + (lower.includes(title.replace(/ /g, "-")) ? 15 : 0); }

function extractContacts(content: string, pageUrl: string, job: NormalizedJob): { phone?: string; email?: string; evidence: JobContactEvidence[] } {
  if (!companyMatches(job.companyName, pageUrl)) return { evidence: [] };
  const pageHost = host(pageUrl); if (!pageHost) return { evidence: [] };
  const emails = new Set<string>(); const phones = new Set<string>();
  for (const email of content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []) emails.add(email.toLowerCase());
  for (const email of emails) { const d = email.split("@")[1] ?? ""; if (d === pageHost || d.endsWith(`.${pageHost}`)) { /* keep */ } else continue; }
  for (const raw of content.match(/(?:\+?\d[\d\s().-]{6,}\d)/g) ?? []) { const digits = raw.replace(/\D/g, ""); if (digits.length >= 7 && digits.length <= 15) phones.add(raw.replace(/\s+/g, " ").trim()); }
  const evidence: JobContactEvidence[] = [];
  for (const email of emails) { const d = email.split("@")[1] ?? ""; if (d === pageHost || d.endsWith(`.${pageHost}`)) evidence.push({ value: email, url: pageUrl, reason: "Public employer-domain email published on the employer website." }); }
  for (const phone of phones) evidence.push({ value: phone, url: pageUrl, reason: "Public phone number published on the employer website." });
  return { phone: evidence.find((item) => /phone/i.test(item.reason))?.value, email: evidence.find((item) => /email/i.test(item.reason))?.value, evidence: evidence.slice(0, 10) };
}

async function firecrawlSearch(query: string, limit = 8): Promise<SearchItem[]> {
  const key = process.env.FIRECRAWL_API_KEY?.trim(); if (!key) return [];
  try {
    const response = await fetch("https://api.firecrawl.dev/v2/search", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown", "html", "links"], onlyMainContent: true } }), cache: "no-store", signal: AbortSignal.timeout(Number(process.env.FIRECRAWL_SEARCH_TIMEOUT_MS) || 45_000) });
    if (!response.ok) return [];
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body?.results) ? body.results : [];
    return rows.flatMap((row: any) => { const url = cleanUrl(row?.url ?? row?.metadata?.sourceURL); const title = typeof row?.title === "string" ? row.title : typeof row?.metadata?.title === "string" ? row.metadata.title : ""; if (!url || blocked(url) || !title) return []; return [{ title, url, snippet: typeof row?.description === "string" ? row.description : typeof row?.markdown === "string" ? row.markdown.slice(0, 800) : undefined, metadata: row }]; });
  } catch { return []; }
}

async function firecrawlScrape(url: string): Promise<FirecrawlResult | undefined> {
  const key = process.env.FIRECRAWL_API_KEY?.trim(); if (!key) return undefined; const safe = cleanUrl(url); if (!safe || blocked(safe)) return undefined;
  try {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ url: safe, formats: ["markdown", "html", "links"], onlyMainContent: true, timeout: Number(process.env.FIRECRAWL_TIMEOUT_MS) || 60_000 }), cache: "no-store", signal: AbortSignal.timeout(Number(process.env.FIRECRAWL_TIMEOUT_MS) || 60_000) });
    if (!response.ok) return undefined; const body = await response.json().catch(() => null) as any; if (!body?.success) return undefined; return { ...(body.data ?? {}), url: safe };
  } catch { return undefined; }
}

async function searchCandidates(job: NormalizedJob) {
  const location = [job.city, job.location, job.countryCode].filter(Boolean).join(" ");
  const queries = [
    `"${job.companyName}" "${job.title}" official careers apply ${location}`,
    `"${job.companyName}" "${job.title}" application ${location}`,
    `"${job.companyName}" careers jobs ${location}`,
    `"${job.companyName}" contact phone email ${location}`,
  ];
  const results: SearchItem[] = [];
  for (const query of queries) {
    const [firecrawl, evidence] = await Promise.all([
      firecrawlSearch(query, 8),
      searchEvidence({ businessName: job.companyName, location, country: job.countryCode, category: "company", limit: 8, query }, "both").catch(() => ({ results: [] } as any)),
    ]);
    results.push(...firecrawl, ...(evidence.results?.flatMap((result: any) => result.results ?? []) ?? []));
  }
  return Array.from(new Map(results.map((item) => [item.url, item])).values());
}

export async function deepResolveJob(job: NormalizedJob): Promise<NormalizedJob> {
  const candidates = await searchCandidates(job);
  const employer = candidates.map((item) => ({ item, score: companyScore(job.companyName, item) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  const jobCandidates = candidates.map((item) => ({ item, score: jobScore(job, item) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
  const pages: Array<{ url: string; content: string; links: string[] }> = [];
  const seedUrls = Array.from(new Set([
    job.companyWebsite,
    ...employer.map((x) => x.item.url),
    ...jobCandidates.map((x) => x.item.url),
  ].filter(Boolean) as string[])).slice(0, 8);
  for (const url of seedUrls) {
    const page = await firecrawlScrape(url); if (!page) continue;
    const content = [page.markdown, page.html].filter(Boolean).join("\n");
    const links = Array.from(new Set([...(page.links ?? []), ...(page.html ? extractLinks(page.html, page.url ?? url) : [])].map(cleanUrl).filter(Boolean) as string[]));
    pages.push({ url: page.url ?? url, content, links });
  }

  let companyWebsite = job.companyWebsite;
  const employerPage = pages.find((page) => companyMatches(job.companyName, page.url));
  if (!companyWebsite && employerPage) companyWebsite = employerPage.url;
  if (!companyWebsite) companyWebsite = employer.find((x) => companyMatches(job.companyName, x.item.url))?.item.url;

  const allLinks = Array.from(new Set([...pages.flatMap((page) => page.links), ...jobCandidates.map((x) => x.item.url)]));
  const applicationCandidates = allLinks
    .filter((url) => !blocked(url))
    .map((url) => ({ url, score: linkScore(job, url) + (jobCandidates.find((x) => x.item.url === url)?.score ?? 0) }))
    .filter((x) => x.score >= 35 && (companyMatches(job.companyName, x.url) || ats(x.url)))
    .sort((a, b) => b.score - a.score);

  let applyUrl = job.applyUrl;
  if (!applyUrl || blocked(applyUrl) || (!companyMatches(job.companyName, applyUrl) && !ats(applyUrl))) applyUrl = undefined;
  for (const candidate of applicationCandidates) {
    if (!applyUrl) applyUrl = candidate.url;
    if (candidate.url === applyUrl) break;
  }

  let companyPhone = job.companyPhone;
  let companyEmail = job.companyEmail;
  let companyContactUrl = job.companyContactUrl;
  const contactEvidence: JobContactEvidence[] = [...(job.companyContactEvidence ?? [])];
  for (const page of pages) {
    const contacts = extractContacts(page.content, page.url, job);
    if (contacts.phone && !companyPhone) companyPhone = contacts.phone;
    if (contacts.email && !companyEmail) companyEmail = contacts.email;
    contactEvidence.push(...contacts.evidence);
    if (!companyContactUrl && /contact/i.test(page.url)) companyContactUrl = page.url;
  }
  const contactPage = pages.flatMap((page) => page.links.map((url) => ({ url, score: /contact/i.test(url) ? 20 : /about|team|people/i.test(url) ? 5 : 0 }))).sort((a, b) => b.score - a.score)[0];
  if (!companyContactUrl && contactPage?.score) companyContactUrl = contactPage.url;

  let verification = { status: job.verificationStatus, score: job.verificationScore, reasons: job.verificationReasons, evidence: job.verificationEvidence, companyDomain: job.companyDomain };
  try { verification = await verifyEmployer({ ...job, companyWebsite, companyDomain: companyWebsite ? host(companyWebsite) : job.companyDomain, applyUrl, sourceUrl: job.sourceUrl }); } catch { /* preserve previous state */ }
  const dedupedContacts = Array.from(new Map(contactEvidence.map((item) => [`${item.value}|${item.url}`, item])).values()).slice(0, 12);
  const reasons = [...verification.reasons];
  if (!applyUrl) reasons.push("Vantage exhausted public employer and ATS search candidates but could not establish a verified application destination.");
  if (!companyPhone && !companyEmail) reasons.push("Vantage exhausted public employer-domain contact pages but could not establish a public phone or email.");
  return { ...job, companyWebsite, companyDomain: verification.companyDomain ?? (companyWebsite ? host(companyWebsite) : job.companyDomain), applyUrl, sourceUrl: applyUrl ?? job.sourceUrl, companyPhone, companyEmail, companyContactUrl, companyContactEvidence: dedupedContacts, verificationStatus: verification.status, verificationScore: verification.score, verificationReasons: reasons, verificationEvidence: verification.evidence };
}

export async function deepResolveJobs(jobs: NormalizedJob[], concurrency = 3) {
  const output = [...jobs]; const queue = jobs.map((job, index) => ({ job, index })); const workers = Math.min(Math.max(1, concurrency), queue.length || 1);
  async function worker() { while (queue.length) { const item = queue.shift(); if (!item) return; try { output[item.index] = await deepResolveJob(item.job); } catch { output[item.index] = item.job; } } }
  await Promise.all(Array.from({ length: workers }, () => worker())); return output;
}
