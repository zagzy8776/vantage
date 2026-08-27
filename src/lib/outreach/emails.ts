/**
 * Public email extraction helpers.
 * Only returns addresses observed in public HTML — never guessed.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const BLOCKED_LOCAL = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "webmaster",
  "example",
  "test",
  "privacy",
  "legal",
]);

const BLOCKED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "domain.com",
  "email.com",
  "sentry.io",
  "wixpress.com",
  "squarespace.com",
  "github.com",
  "google.com",
  "gstatic.com",
  "schema.org",
]);

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase().replace(/^mailto:/i, "").split("?")[0]?.trim();
  if (!email || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  if (BLOCKED_LOCAL.has(local) || local.startsWith("noreply") || local.startsWith("no-reply")) return null;
  if (BLOCKED_DOMAINS.has(domain) || domain.endsWith(".png") || domain.endsWith(".jpg")) return null;
  if (local.length > 64 || domain.length > 255) return null;
  return email;
}

/** Prefer role-style / contact addresses slightly over personal-looking ones. */
function rankEmail(email: string): number {
  const local = email.split("@")[0] ?? "";
  if (/^(info|contact|hello|hi|enquiries|inquiries|admin|office|bookings|booking|support)$/i.test(local)) return 0;
  if (local.includes(".")) return 2;
  return 1;
}

export function extractEmailsFromText(text: string): string[] {
  const found = text.match(EMAIL_RE) ?? [];
  const normalized = found.map(normalizeEmail).filter((v): v is string => Boolean(v));
  return Array.from(new Set(normalized)).sort((a, b) => rankEmail(a) - rankEmail(b) || a.localeCompare(b));
}

export function extractEmailsFromHtml(html: string): string[] {
  const decoded = decodeHtml(html);
  const fromMailto: string[] = [];
  const mailtoRe = /mailto:([^"'\s>?]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = mailtoRe.exec(decoded))) {
    const email = normalizeEmail(decodeURIComponent(match[1]));
    if (email) fromMailto.push(email);
  }
  const fromText = extractEmailsFromText(decoded.replace(/<[^>]+>/g, " "));
  const merged = Array.from(new Set([...fromMailto, ...fromText]));
  return merged.sort((a, b) => rankEmail(a) - rankEmail(b) || a.localeCompare(b));
}

export function pickBestEmail(emails: string[]): string | null {
  return emails[0] ?? null;
}
