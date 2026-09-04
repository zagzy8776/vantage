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

function promptFor(job: NormalizedJob) {
  return `Analyze this job listing for a candidate. Use ONLY the supplied listing text and structured fields. Public-source research may have expanded the listing, but treat it as evidence, not permission to guess. Do not invent requirements, salary, employer facts, eligibility rules, or application steps. If something is not stated, put it in unknowns or leave the optional field empty.

Return JSON only with exactly these fields:
summary (string), seniority (string|null), mustHave (string[]), niceToHave (string[]), skills (string[]), experience (string|null), education (string|null), responsibilities (string[]), locationRequirement (string|null), remotePolicy (string|null), applicationAdvice (string[]), unknowns (string[]), confidence (integer 0-100).

Job title: ${job.title}
Employer: ${job.companyName}
Location: ${job.location ?? "not stated"}
Employment type: ${job.employmentType ?? "not stated"}
Remote field: ${job.remote === undefined ? "not stated" : job.remote ? "remote" : "not remote"}
Employer website: ${job.companyWebsite ?? "not established"}
Application URL: ${job.applyUrl ?? "not established"}
Structured requirements: ${(job.requirements ?? []).join(" | ") || "none"}

Listing and researched public-source text:
${(job.description ?? "").slice(0, 26000)}`;
}

const SYSTEM = "You are Vantage Job Intelligence. Your job is to turn real job-source and public employer-page evidence into a precise description of what the employer is asking for. Never fill gaps with general assumptions. Separate must-have requirements from preferences. Treat missing information as unknown. A third-party job provider is evidence of discovery, not evidence of employer ownership.";

export async function analyzeJob(job: NormalizedJob): Promise<JobIntelligence | undefined> {
  const source = [job.description, ...(job.requirements ?? [])].filter(Boolean).join("\n").trim();
  if (source.length < 40) return undefined;

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
    return { ...intelligence, provider: result.provider, model: result.model };
  } catch (error) {
    console.error(JSON.stringify({ diagnostic: "job_ai_analysis_failed", jobId: job.id, message: error instanceof Error ? error.message : String(error) }));
    return undefined;
  }
}

export async function analyzeJobs(jobs: NormalizedJob[], maxJobs = 12) {
  const researchLimit = Math.max(maxJobs, Math.min(Number(process.env.JOB_SOURCE_RESEARCH_LIMIT) || 20, jobs.length));
  const researched = await researchJobs(jobs, researchLimit);
  const selected = researched.filter((job) => (job.description?.trim().length ?? 0) >= 40 || (job.requirements?.length ?? 0) > 0).slice(0, maxJobs);
  const queue = [...selected];
  const results = new Map<string, JobIntelligence>();
  const concurrency = Math.max(1, Math.min(Number(process.env.JOB_AI_ANALYSIS_CONCURRENCY) || 2, 4));

  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      if (!job) return;
      const intelligence = await analyzeJob(job);
      if (intelligence) results.set(job.id, intelligence);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));
  return { jobs: researched.map((job) => results.has(job.id) ? { ...job, intelligence: results.get(job.id) } : job), analyzed: results.size, attempted: selected.length };
}
