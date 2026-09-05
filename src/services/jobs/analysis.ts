import { generateWithFallback } from "@/providers/ai/router";
import type { JobIntelligence, NormalizedJob } from "@/providers/jobs/types";
import { researchJobs } from "./source-research";

function cleanJson(content: string) {
  return content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}

function strings(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${field} must be an array of strings.`);
  return value.map((item) => (item as string).trim()).slice(0, 12);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseJobIntelligence(content: string): JobIntelligence {
  const value = JSON.parse(cleanJson(content)) as Record<string, unknown>;
  if (!value || typeof value !== "object") throw new Error("AI job analysis must be an object.");
  if (typeof value.summary !== "string" || !value.summary.trim()) throw new Error("AI job analysis summary is missing.");
  if (typeof value.confidence !== "number" || !Number.isInteger(value.confidence) || value.confidence < 0 || value.confidence > 100) throw new Error("AI job analysis confidence is invalid.");
  return {
    summary: value.summary.trim().slice(0, 600),
    seniority: optionalString(value.seniority),
    mustHave: strings(value.mustHave, "mustHave"),
    niceToHave: strings(value.niceToHave, "niceToHave"),
    skills: strings(value.skills, "skills"),
    experience: optionalString(value.experience),
    education: optionalString(value.education),
    responsibilities: strings(value.responsibilities, "responsibilities"),
    locationRequirement: optionalString(value.locationRequirement),
    remotePolicy: optionalString(value.remotePolicy),
    applicationAdvice: strings(value.applicationAdvice, "applicationAdvice"),
    unknowns: strings(value.unknowns, "unknowns"),
    confidence: value.confidence,
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sourceText(job: NormalizedJob) {
  return normalizeWhitespace([job.description, ...(job.requirements ?? [])].filter(Boolean).join("\n"));
}

function section(text: string, heading: RegExp, nextHeadings: string[]) {
  const match = text.match(new RegExp(`${heading.source}\\s*[:\\-]?\\s*([\\s\\S]{0,3200}?)(?=\\b(?:${nextHeadings.join("|")})\\b\\s*[:\\-]|$)`, "i"));
  return normalizeWhitespace(match?.[1] ?? "");
}

function bulletItems(text: string) {
  const values = text
    .split(/(?:\n|\r|•|\u2022|\||(?<=\.)\s+(?=[A-Z]))/)
    .map((item) => item.replace(/^[-*–—]\s*/, "").trim())
    .filter((item) => item.length >= 8 && item.length <= 220);
  return Array.from(new Set(values)).slice(0, 12);
}

const skillPatterns = [
  "AWS", "Azure", "GCP", "Kubernetes", "Docker", "Terraform", "Ansible", "Linux", "Python", "JavaScript", "TypeScript", "Java", "C#", "C++", "Go", "Rust", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "React", "Next.js", "Node.js", "Git", "GitHub", "CI/CD", "Jenkins", "GitLab", "PowerShell", "Bash", "Networking", "TCP/IP", "IAM", "DevOps", "Cybersecurity", "Splunk", "Datadog", "Grafana", "Prometheus", "Snowflake", "Salesforce", "SAP", "Excel"
];

function extractSkills(text: string) {
  return skillPatterns.filter((skill) => new RegExp(`(^|[^A-Za-z0-9+#.])${skill.replace(/[.+]/g, "\\$&")}(?=$|[^A-Za-z0-9+#.])`, "i").test(text)).slice(0, 12);
}

function deterministicIntelligence(job: NormalizedJob): JobIntelligence {
  const text = sourceText(job);
  const requirements = Array.from(new Set(job.requirements ?? [])).filter((item) => item.trim()).slice(0, 12);
  const requirementsSection = section(text, /(?:requirements?|qualifications?|what you(?:'|’)ll need|must[- ]have|you bring)/i, ["responsibilities", "what you(?:'|’)ll do", "preferred", "nice to have", "benefits", "about the company"]);
  const preferredSection = section(text, /(?:preferred|nice[- ]to[- ]have|bonus|desirable)/i, ["responsibilities", "what you(?:'|’)ll do", "benefits", "about the company"]);
  const responsibilitiesSection = section(text, /(?:responsibilities|what you(?:'|’)ll do|your role|duties)/i, ["requirements?", "qualifications?", "preferred", "nice to have", "benefits", "about the company"]);
  const mustHave = requirements.length ? requirements : bulletItems(requirementsSection || text).filter((item) => /\b(required|must|need|experience|proficien|knowledge|ability|degree|certif|license|years?)\b/i.test(item)).slice(0, 10);
  const niceToHave = bulletItems(preferredSection).slice(0, 8);
  const responsibilities = bulletItems(responsibilitiesSection).slice(0, 10);
  const skills = extractSkills(text);
  const experience = text.match(/\b(\d+(?:\.\d+)?\+?\s+years?[^.;,\n]{0,100})/i)?.[1]?.trim();
  const education = text.match(/\b((?:bachelor(?:'s)?|master(?:'s)?|associate(?:'s)?|phd|doctorate|diploma|degree)[^.;,\n]{0,120})/i)?.[1]?.trim();
  const remotePolicy = job.remote === true ? "The provider marks this listing as remote." : /\b(remote|hybrid|on[- ]site|in[- ]person)\b/i.test(text) ? text.match(/\b(remote|hybrid|on[- ]site|in[- ]person)[^.;,\n]{0,100}/i)?.[0]?.trim() : undefined;
  const locationRequirement = job.location ?? job.city ?? job.countryCode;
  const unknowns: string[] = [];
  if (!text) unknowns.push("The listing did not provide enough public description text for deeper requirement extraction.");
  if (!experience) unknowns.push("Required years of experience are not established from the available source text.");
  if (!education) unknowns.push("Education requirements are not established from the available source text.");
  if (!responsibilities.length) unknowns.push("Responsibilities were not separately stated in the available source text.");
  if (!job.applyUrl && !job.companyWebsite) unknowns.push("A direct employer application path has not been established.");
  if (!job.companyPhone && !job.companyEmail) unknowns.push("No public employer phone or email has been established.");

  const evidenceSignals = [text.length >= 100, mustHave.length > 0, responsibilities.length > 0, skills.length > 0, Boolean(job.companyWebsite), Boolean(job.applyUrl)].filter(Boolean).length;
  const confidence = Math.min(88, 38 + evidenceSignals * 8 + Math.min(18, Math.floor(text.length / 1200) * 3));
  const summary = text
    ? `Evidence-based requirements for ${job.title} at ${job.companyName} were extracted from the available listing and public-source text.`
    : `The available listing identifies ${job.title} at ${job.companyName}, but its public description is limited; Vantage is showing only facts it can establish.`;

  return {
    summary,
    seniority: text.match(/\b(intern|junior|mid[- ]level|senior|lead|principal|staff|manager|director|executive|entry[- ]level)\b/i)?.[1],
    mustHave,
    niceToHave,
    skills,
    experience,
    education,
    responsibilities,
    locationRequirement,
    remotePolicy,
    applicationAdvice: job.applyUrl ? ["Use the established application path and follow the employer's stated instructions."] : job.companyWebsite ? ["Visit the established employer website and locate the relevant careers/application page."] : ["Vantage has not established a direct application path yet; do not rely on an unverified redirect."],
    unknowns,
    confidence,
    provider: "evidence",
    source: "evidence",
  };
}

function promptFor(job: NormalizedJob) {
  return `Analyze this job listing for a candidate. Use ONLY the supplied listing text and structured fields. Public-source research may have expanded the listing, but treat it as evidence, not permission to guess. Do not invent requirements, salary, employer facts, eligibility rules, or application steps. If something is not stated, put it in unknowns or leave the optional field empty. If the source text is partial, explicitly reflect that uncertainty in unknowns and lower confidence rather than filling gaps from general knowledge.\n\nReturn JSON only with exactly these fields:\nsummary (string), seniority (string|null), mustHave (string[]), niceToHave (string[]), skills (string[]), experience (string|null), education (string|null), responsibilities (string[]), locationRequirement (string|null), remotePolicy (string|null), applicationAdvice (string[]), unknowns (string[]), confidence (integer 0-100).\n\nJob title: ${job.title}\nEmployer: ${job.companyName}\nLocation: ${job.location ?? "not stated"}\nEmployment type: ${job.employmentType ?? "not stated"}\nRemote field: ${job.remote === undefined ? "not stated" : job.remote ? "remote" : "not remote"}\nEmployer website: ${job.companyWebsite ?? "not established"}\nApplication URL: ${job.applyUrl ?? "not established"}\nStructured requirements: ${(job.requirements ?? []).join(" | ") || "none"}\n\nListing and researched public-source text:\n${(job.description ?? "").slice(0, 26000)}`;
}

const SYSTEM = "You are Vantage Job Intelligence. Your job is to turn real job-source and public employer-page evidence into a precise description of what the employer is asking for. Never fill gaps with general assumptions. Separate must-have requirements from preferences. Treat missing information as unknown. A third-party job provider is evidence of discovery, not evidence of employer ownership.";

export async function analyzeJob(job: NormalizedJob): Promise<JobIntelligence> {
  const fallback = deterministicIntelligence(job);
  const source = sourceText(job);
  if (source.length < 40) return fallback;

  try {
    const result = await generateWithFallback({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: promptFor(job) },
      ],
      temperature: 0,
      maxTokens: 1800,
      responseFormat: "json",
    }, {
      validate: (content) => { parseJobIntelligence(content); },
      repairRequest: (content) => ({
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Repair the following response into valid JSON matching the requested schema. Keep only claims supported by the supplied job/public-source evidence.\n\n${content}` },
        ],
        temperature: 0,
        maxTokens: 1800,
        responseFormat: "json",
      }),
    });
    const intelligence = parseJobIntelligence(result.content);
    return { ...intelligence, provider: result.provider, model: result.model, source: "ai" };
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "job_ai_analysis_failed", jobId: job.id, message: error instanceof Error ? error.message : String(error) }));
    return fallback;
  }
}

export async function analyzeJobs(jobs: NormalizedJob[], maxJobs = jobs.length) {
  const configuredResearchLimit = Number(process.env.JOB_SOURCE_RESEARCH_LIMIT);
  const researchLimit = Number.isFinite(configuredResearchLimit) && configuredResearchLimit > 0
    ? Math.min(Math.floor(configuredResearchLimit), jobs.length)
    : jobs.length;
  const researched = await researchJobs(jobs, researchLimit);
  const selected = researched.slice(0, Math.max(0, Math.min(maxJobs, researched.length)));
  const queue = [...selected];
  const results = new Map<string, JobIntelligence>();
  const configuredConcurrency = Number(process.env.JOB_AI_ANALYSIS_CONCURRENCY) || 2;
  const concurrency = Math.max(1, Math.min(configuredConcurrency, 4));

  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      if (!job) return;
      const intelligence = await analyzeJob(job);
      results.set(job.id, intelligence);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));
  return { jobs: researched.map((job) => ({ ...job, intelligence: results.get(job.id) ?? deterministicIntelligence(job) })), analyzed: Array.from(results.values()).filter((item) => item.source === "ai").length, attempted: selected.length, evidenceReady: researched.length };
}
