import type { ScoreTier } from "./types";

/** Map a 0–100 opportunity score to its severity tier. */
export function getScoreTier(score: number): ScoreTier {
  if (score >= 90) return "exceptional";
  if (score >= 80) return "high";
  if (score >= 70) return "promising";
  if (score >= 50) return "moderate";
  return "low";
}

export interface ScoreTierMeta {
  label: string;
  range: string;
  /** Token-based Tailwind classes — centralized so tiers stay consistent. */
  text: string;
  bg: string;
  border: string;
  bar: string;
  ring: string;
}

/** Visual metadata per tier. Consumed by score components everywhere. */
export const SCORE_TIER_META: Record<ScoreTier, ScoreTierMeta> = {
  exceptional: {
    label: "Exceptional",
    range: "90–100",
    text: "text-score-exceptional",
    bg: "bg-score-exceptional/10",
    border: "border-score-exceptional/40",
    bar: "bg-score-exceptional",
    ring: "stroke-score-exceptional",
  },
  high: {
    label: "High",
    range: "80–89",
    text: "text-score-high",
    bg: "bg-score-high/10",
    border: "border-score-high/40",
    bar: "bg-score-high",
    ring: "stroke-score-high",
  },
  promising: {
    label: "Promising",
    range: "70–79",
    text: "text-score-promising",
    bg: "bg-score-promising/10",
    border: "border-score-promising/40",
    bar: "bg-score-promising",
    ring: "stroke-score-promising",
  },
  moderate: {
    label: "Moderate",
    range: "50–69",
    text: "text-score-moderate",
    bg: "bg-score-moderate/10",
    border: "border-score-moderate/40",
    bar: "bg-score-moderate",
    ring: "stroke-score-moderate",
  },
  low: {
    label: "Low",
    range: "below 50",
    text: "text-score-low",
    bg: "bg-score-low/10",
    border: "border-score-low/40",
    bar: "bg-score-low",
    ring: "stroke-score-low",
  },
};
