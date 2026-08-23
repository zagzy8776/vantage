import { clsx, type ClassValue } from "clsx";

/** Compose conditional class names. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Deterministic date formatting (safe for SSR — no relative time drift). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** Strip protocol for compact display of a URL. */
export function formatDomain(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** "Aurelia Beauty Atelier" → "AB" */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
