import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { businesses, evidenceItems, leads } from "@/lib/db/schema";
import { generateWithFallback } from "@/providers/ai/router";
import { extractEmailsFromText, pickBestEmail } from "@/lib/outreach/emails";
import type { AIRequest } from "@/services/intelligence/types";

export type OutreachDraft = {
  subject: string;
  body: string;
  toEmail: string | null;
  phone: string | null;
  businessName: string;
  source: "ai" | "template";
};

function buildTemplate(input: {
  name: string;
  category: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  reason: string;
  opportunityScore: number;
}): { subject: string; body: string } {
  const place = [input.city, input.country].filter(Boolean).join(", ") || "your area";
  const category = input.category?.trim() || "local business";
  const gap = input.website
    ? input.reason || "there may be room to improve how customers find and book you online"
    : "I could not find a public website for the business";

  const subject = `Quick idea for ${input.name}`;
  const body = [
    `Hi,`,
    ``,
    `I came across ${input.name} in ${place} while researching ${category.toLowerCase()} businesses.`,
    ``,
    `${gap.endsWith(".") ? gap : `${gap}.`} I help owners in this space with simple websites, online booking, and getting found by more local customers.`,
    ``,
    `If useful, I can share a few specific ideas for ${input.name} — no obligation.`,
    ``,
    `Would you be open to a short reply if that sounds relevant?`,
    ``,
    `Thanks,`,
  ].join("\n");

  return { subject, body };
}

function parseDraftJson(content: string): { subject: string; body: string } | null {
  const trimmed = content.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as { subject?: unknown; body?: unknown };
    if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") return null;
    const subject = parsed.subject.trim().slice(0, 200);
    const body = parsed.body.trim().slice(0, 4000);
    if (!subject || !body) return null;
    return { subject, body };
  } catch {
    return null;
  }
}

export async function generateOutreachDraft(leadId: string): Promise<OutreachDraft> {
  const db = getDb();
  const rows = await db
    .select({
      leadId: leads.id,
      opportunityScore: leads.opportunityScore,
      reason: leads.reason,
      websiteStatus: leads.websiteStatus,
      businessId: businesses.id,
      name: businesses.name,
      category: businesses.category,
      country: businesses.country,
      city: businesses.city,
      phone: businesses.phone,
      website: businesses.website,
    })
    .from(leads)
    .innerJoin(businesses, eq(leads.businessId, businesses.id))
    .where(eq(leads.id, leadId))
    .limit(1);

  const lead = rows[0];
  if (!lead) throw new Error("Lead not found");

  const evidenceRows = await db
    .select({
      category: evidenceItems.category,
      statement: evidenceItems.statement,
      value: evidenceItems.value,
    })
    .from(evidenceItems)
    .where(eq(evidenceItems.businessId, lead.businessId))
    .limit(80);

  const emailsFromEvidence: string[] = [];
  for (const row of evidenceRows) {
    if (row.category !== "contact") continue;
    if (row.value) emailsFromEvidence.push(...extractEmailsFromText(row.value));
    emailsFromEvidence.push(...extractEmailsFromText(row.statement));
  }
  const toEmail = pickBestEmail(emailsFromEvidence);

  const template = buildTemplate({
    name: lead.name,
    category: lead.category,
    city: lead.city,
    country: lead.country,
    website: lead.website,
    reason: lead.reason,
    opportunityScore: lead.opportunityScore,
  });

  const evidenceLines = evidenceRows
    .slice(0, 12)
    .map((row) => `- [${row.category}] ${row.statement}${row.value ? ` (${row.value})` : ""}`)
    .join("\n");

  const request: AIRequest = {
    messages: [
      {
        role: "system",
        content:
          "You write short, professional cold outreach emails for a web developer who helps local businesses improve websites, booking, and online presence. Only use facts provided. Never invent audits, metrics, or contact details. Return JSON only: {\"subject\":string,\"body\":string}. Body should be plain text, under 180 words, friendly, one clear ask.",
      },
      {
        role: "user",
        content: [
          `Business name: ${lead.name}`,
          `Category: ${lead.category ?? "unknown"}`,
          `Location: ${[lead.city, lead.country].filter(Boolean).join(", ") || "unknown"}`,
          `Website: ${lead.website ?? "none found"}`,
          `Website status: ${lead.websiteStatus}`,
          `Opportunity score: ${lead.opportunityScore}`,
          `Why this lead: ${lead.reason}`,
          `Public email if any: ${toEmail ?? "none found"}`,
          `Evidence:`,
          evidenceLines || "(none)",
          ``,
          `Write subject + body the user can paste into their own email client. Do not include a signature name; end with Thanks,`,
        ].join("\n"),
      },
    ],
    temperature: 0.4,
    maxTokens: 700,
  };

  try {
    const result = await generateWithFallback(request, {
      validate: (content) => {
        if (!parseDraftJson(content)) throw new Error("invalid outreach json");
      },
    });
    const parsed = parseDraftJson(result.content);
    if (parsed) {
      return {
        subject: parsed.subject,
        body: parsed.body,
        toEmail,
        phone: lead.phone,
        businessName: lead.name,
        source: "ai",
      };
    }
  } catch {
    // Template fallback keeps outreach usable when AI is offline.
  }

  return {
    subject: template.subject,
    body: template.body,
    toEmail,
    phone: lead.phone,
    businessName: lead.name,
    source: "template",
  };
}

export async function markLeadContacted(leadId: string): Promise<void> {
  const db = getDb();
  const updated = await db
    .update(leads)
    .set({ status: "contacted", updatedAt: new Date() })
    .where(eq(leads.id, leadId))
    .returning({ id: leads.id });
  if (!updated[0]) throw new Error("Lead not found");
}

/** Best public email for a business from stored contact evidence. */
export async function getBusinessPublicEmail(businessId: string): Promise<string | null> {
  const rows = await getDb()
    .select({ category: evidenceItems.category, statement: evidenceItems.statement, value: evidenceItems.value })
    .from(evidenceItems)
    .where(eq(evidenceItems.businessId, businessId))
    .limit(100);

  const emails: string[] = [];
  for (const row of rows) {
    if (row.category !== "contact") continue;
    if (row.value) emails.push(...extractEmailsFromText(row.value));
    emails.push(...extractEmailsFromText(row.statement));
  }
  return pickBestEmail(emails);
}
