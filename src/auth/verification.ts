/**
 * Email verification - pure verification logic.
 *
 * Codes are generated with crypto.randomInt (CSPRNG) and stored only as
 * HMAC-SHA256 hashes keyed by the JWT secret pepper. Plaintext codes exist
 * exclusively in memory long enough to be emailed.
 *
 * DB persistence lives in ./verification-store; this module is kept pure
 * so expiry/attempt/hash rules are unit-testable without a database.
 */

import { createHmac, randomInt, timingSafeEqual } from "crypto";

/** Verification code lifetime: 10 minutes */
export const CODE_TTL_MS = 10 * 60 * 1000;

/** Maximum failed attempts before a code is dead */
export const MAX_ATTEMPTS = 5;

/** Minimum delay between resending codes to the same account */
export const RESEND_COOLDOWN_MS = 60 * 1000;

export interface VerificationRecord {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  verifiedAt: Date | null;
  createdAt: Date;
}

export type VerificationOutcome =
  | "ok"
  | "invalid"
  | "expired"
  | "too_many_attempts";

/**
 * Generate a cryptographically secure 6-digit code.
 * crypto.randomInt is unbiased across 000000-999999.
 */
export function generateVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function getPepper(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required to hash verification codes.");
    }
    // Non-production fallback keeps local flows working without secrets.
    return "vantage-dev-verification-pepper";
  }
  return secret;
}

/**
 * Hash a plaintext code for storage. The hash is deterministic per secret
 * (enabling comparison) but never reversible without the server secret.
 */
export function hashCodeVerification(code: string): string {
  return createHmac("sha256", getPepper()).update(code, "utf8").digest("hex");
}

function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Evaluate a submitted code against a pending verification record.
 * Pure - persistence of attempt increments / verified flags is the caller's job.
 */
export function evaluateVerification(
  record: Pick<VerificationRecord, "codeHash" | "expiresAt" | "attempts" | "verifiedAt">,
  submittedCode: string,
  now: Date = new Date()
): VerificationOutcome {
  if (record.verifiedAt) return "invalid";
  if (record.attempts >= MAX_ATTEMPTS) return "too_many_attempts";
  if (now.getTime() > record.expiresAt.getTime()) return "expired";

  const normalized = submittedCode.trim();
  if (!/^\d{6}$/.test(normalized)) return "invalid";
  if (!hashesMatch(hashCodeVerification(normalized), record.codeHash)) {
    return "invalid";
  }
  return "ok";
}

/**
 * Whether enough time has passed since the last code was issued to resend.
 */
export function isResendAllowed(
  lastIssuedAt: Date,
  now: Date = new Date()
): boolean {
  return now.getTime() - lastIssuedAt.getTime() >= RESEND_COOLDOWN_MS;
}

/** Seconds remaining until a code expires (for UI countdowns). */
export function secondsUntilExpiry(expiresAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}
