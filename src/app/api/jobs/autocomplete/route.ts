import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAuth } from "@/auth/middleware";
import { getDb } from "@/lib/db";
import { generateWithFallback } from "@/providers/ai/router";

export const dynamic = "force-dynamic";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function scoreTitle(title: string, query: string) {
  const normalizedTitle = normalize(title);
  const normalizedQuery = normalize(query);
  if (!normalizedTitle || !normalizedQuery) return 0;
  if (normalizedTitle === normalizedQuery) return 100;
  if (normalizedTitle.startsWith(normalizedQuery)) return 90;
  if (normalizedTitle.includes(normalizedQuery)) return 75;
  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
  const titleTokens = new Set(normalizedTitle.split(" "));
  const hits = queryTokens.filter((token) => titleTokens.has(token)).length;
  return hits ? 40 + Math.round((hits / queryTokens.length) * 30) : 0;
}

function cleanSuggestions(value: unknown, query: string) {
  const items = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  return items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter((item) => item.length >= 2 && item.length <= 80)
    .filter((item) => {
      const key = normalize(item);
      if (!key || seen.has(key) || scoreTitle(item, query) === 0) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

async function learnedTitles(query: string, userId: string, organizationId?: string | null) {
  const db = getDb();
  const where = sql`owner_id = ${userId} AND (${organizationId ?? null} IS NULL OR organization_id = ${organizationId ?? null})`;
  const result = await db.execute(sql`
    SELECT title, COUNT(*)::int AS frequency
    FROM jobs
    WHERE ${where} AND title IS NOT NULL AND LENGTH(TRIM(title)) BETWEEN 2 AND 100
    GROUP BY title
    ORDER BY frequency DESC, title ASC
    LIMIT 100
  `);
  return result.rows
    .map((row) => ({ title: String((row as { title?: unknown }).title ?? "").trim(), frequency: Number((row as { frequency?: unknown }).frequency ?? 0) }))
    .filter((row) => row.title)
    .sort((a, b) => (scoreTitle(b.title, query) - scoreTitle(a.title, query)) || (b.frequency - a.frequency))
    .filter((row) => scoreTitle(row.title, query) > 0)
    .slice(0, 8)
    .map((row) => row.title);
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  let learned: string[] = [];
  try {
    learned = await learnedTitles(query, auth.userId, auth.organizationId);
    if (learned.length >= 5) return NextResponse.json({ suggestions: learned, source: "learned" });

    const prompt = [
      "Return job-title autocomplete suggestions only.",
      "The suggestions must be real, commonly used job titles, not employers, skills, salaries, or invented roles.",
      "Prefer specific titles that a job search provider is likely to recognize.",
      `User is typing: ${JSON.stringify(query)}`,
      `Already learned from this account: ${JSON.stringify(learned)}`,
      "Return JSON exactly as {\"suggestions\":[\"Job Title\"]} with at most 8 suggestions.",
    ].join("\n");

    const generated = await generateWithFallback({
      messages: [
        { role: "system", content: "You generate concise autocomplete vocabulary for a job search box. Never add explanations." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      responseFormat: "json",
    });
    const parsed = JSON.parse(generated.content) as { suggestions?: unknown };
    const aiSuggestions = cleanSuggestions(parsed.suggestions, query);
    const candidates = [...learned, ...aiSuggestions];
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const item of candidates) {
      const key = normalize(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      if (merged.length >= 8) break;
    }
    return NextResponse.json({ suggestions: merged, source: learned.length ? "learned+intelligence" : "intelligence" });
  } catch {
    return NextResponse.json({ suggestions: learned, source: "learned" });
  }
}
