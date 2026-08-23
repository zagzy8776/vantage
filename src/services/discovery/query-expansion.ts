import { generateWithFallback } from "@/providers/ai/router";

export interface QueryExpansionInput {
  businessType: string;
  country?: string;
  city?: string;
}

export interface SearchIntent {
  normalizedIntent: string;
  location?: string;
  priority: "website" | "balanced" | "local";
  expansionEnabled: boolean;
}

export interface QueryExpansionResult {
  intent: SearchIntent;
  categoryCandidates: string[];
  synonyms: string[];
  relatedBusinessTypes: string[];
  exclusions: string[];
  provider: string;
  fallbackUsed: boolean;
}

const DEFAULT_MAX_EXPANSIONS = 5;

function maxExpansions() {
  const raw = Number(process.env.MAX_CATEGORY_EXPANSIONS);
  return Number.isInteger(raw) && raw > 0 ? Math.min(raw, 8) : DEFAULT_MAX_EXPANSIONS;
}

function cleanList(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))).slice(0, max);
}

function normalizeLocation(country?: string, city?: string) {
  return [city?.trim(), country?.trim()].filter(Boolean).join(", ") || undefined;
}

function deterministicCandidates(businessType: string) {
  const normalized = businessType.trim().toLowerCase();
  const map: Record<string, string[]> = {
    perfume: ["fragrance store", "perfumery", "perfume boutique", "fragrance boutique"],
    wedding: ["bridal boutique", "wedding planner", "luxury event company", "bridal accessories"],
    dental: ["dental clinic", "dentist", "oral health clinic"],
    hotel: ["boutique hotel", "guest house", "hospitality business"],
  };
  const match = Object.entries(map).find(([key]) => normalized.includes(key));
  return match?.[1] ?? [];
}

function fallbackExpansion(input: QueryExpansionInput): QueryExpansionResult {
  const base = input.businessType.trim();
  const candidates = deterministicCandidates(base).slice(0, maxExpansions());
  return {
    intent: { normalizedIntent: base, location: normalizeLocation(input.country, input.city), priority: "balanced", expansionEnabled: candidates.length > 0 },
    categoryCandidates: [base, ...candidates].slice(0, maxExpansions() + 1),
    synonyms: candidates.slice(0, maxExpansions()),
    relatedBusinessTypes: [],
    exclusions: [],
    provider: "deterministic",
    fallbackUsed: true,
  };
}

function parseExpansion(value: unknown, input: QueryExpansionInput): Omit<QueryExpansionResult, "provider" | "fallbackUsed"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid query expansion response.");
  const record = value as Record<string, unknown>;
  const intent = record.intent && typeof record.intent === "object" && !Array.isArray(record.intent) ? record.intent as Record<string, unknown> : {};
  const priority = intent.priority === "website" || intent.priority === "local" ? intent.priority : "balanced";
  const categories = cleanList(record.categoryCandidates, maxExpansions());
  const synonyms = cleanList(record.synonyms, maxExpansions());
  const related = cleanList(record.relatedBusinessTypes, maxExpansions());
  const normalizedIntent = typeof intent.normalizedIntent === "string" && intent.normalizedIntent.trim() ? intent.normalizedIntent.trim() : input.businessType.trim();
  const categoryCandidates = Array.from(new Set([input.businessType.trim(), ...categories, ...synonyms, ...related])).slice(0, maxExpansions() + 1);
  return {
    intent: { normalizedIntent, location: normalizeLocation(input.country, input.city), priority, expansionEnabled: categoryCandidates.length > 1 },
    categoryCandidates,
    synonyms,
    relatedBusinessTypes: related,
    exclusions: cleanList(record.exclusions, maxExpansions()),
  };
}

export async function expandBusinessQuery(input: QueryExpansionInput): Promise<QueryExpansionResult> {
  const fallback = fallbackExpansion(input);
  if (!input.businessType.trim()) return fallback;
  try {
    const result = await generateWithFallback({
      messages: [
        { role: "system", content: "You are a conservative search-intent planner. Interpret only the supplied business type and location. Return JSON with intent {normalizedIntent:string, priority:website|balanced|local}, categoryCandidates:string[], synonyms:string[], relatedBusinessTypes:string[], exclusions:string[]. Never claim that any candidate is a verified business or browse the internet. Keep each list to the requested limit." },
        { role: "user", content: JSON.stringify({ ...input, maxExpansions: maxExpansions() }) },
      ],
      temperature: 0,
      maxTokens: 700,
      responseFormat: "json",
    }, {
      validate: (content) => { parseExpansion(JSON.parse(content), input); },
      repairRequest: (content) => ({ messages: [{ role: "system", content: "Repair this into valid JSON only. Preserve claims, use no external facts, and return intent, categoryCandidates, synonyms, relatedBusinessTypes, exclusions." }, { role: "user", content }], temperature: 0, maxTokens: 700, responseFormat: "json" }),
    });
    return { ...parseExpansion(JSON.parse(result.content), input), provider: result.metadata.provider, fallbackUsed: result.metadata.fallbackUsed };
  } catch {
    return fallback;
  }
}