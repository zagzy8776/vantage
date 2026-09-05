type Rule = { allow: boolean; path: string };
const cache = new Map<string, { expires: number; rules: Rule[] | null }>();
const TTL_MS = 60 * 60 * 1000;

function rulesFrom(body: string) {
  const rules: Rule[] = [];
  let applies = false;
  let sawUserAgent = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.split("#", 1)[0].trim();
    if (!line || !line.includes(":")) continue;
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const field = key.trim().toLowerCase();
    if (field === "user-agent") {
      sawUserAgent = true;
      applies = value === "*" || value.toLowerCase() === "vantagejobsbot";
      continue;
    }
    if (!sawUserAgent || !applies) continue;
    if (field === "allow" || field === "disallow") rules.push({ allow: field === "allow", path: value });
  }
  return rules.filter((rule) => rule.path);
}

async function getRules(origin: string) {
  const cached = cache.get(origin);
  if (cached && cached.expires > Date.now()) return cached.rules;
  try {
    const response = await fetch(`${origin}/robots.txt`, { cache: "no-store", signal: AbortSignal.timeout(4_000), headers: { "User-Agent": "VantageJobsBot/1.0" } });
    if (!response.ok) { cache.set(origin, { expires: Date.now() + TTL_MS, rules: null }); return null; }
    const rules = rulesFrom(await response.text());
    cache.set(origin, { expires: Date.now() + TTL_MS, rules });
    return rules;
  } catch {
    cache.set(origin, { expires: Date.now() + 10 * 60 * 1000, rules: null });
    return null;
  }
}

export async function isAllowedByRobots(url: string) {
  try {
    const parsed = new URL(url);
    const origin = parsed.origin;
    const rules = await getRules(origin);
    if (!rules || rules.length === 0) return true;
    const path = parsed.pathname + parsed.search;
    const matches = rules.filter((rule) => path.startsWith(rule.path)).sort((a, b) => b.path.length - a.path.length);
    return matches[0]?.allow ?? true;
  } catch { return false; }
}
