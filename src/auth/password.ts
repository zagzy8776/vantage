/**
 * Production Hardening Phase 1B: User Issuance
 *
 * Password hashing using Node's built-in scrypt (memory-hard KDF).
 * Stored format: scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
 * No plaintext passwords are ever persisted or logged.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>;

/** OWASP-recommended scrypt parameters */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

/**
 * Hash a password for storage
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return [
    "scrypt",
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

/**
 * Verify a password against a stored hash.
 * Returns false for malformed hashes - never throws on bad input.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = Number.parseInt(nStr, 10);
  const r = Number.parseInt(rStr, 10);
  const p = Number.parseInt(pStr, 10);

  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  let expected: Buffer;
  let derived: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
    derived = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, { N, r, p });
  } catch {
    return false;
  }

  if (expected.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(expected, derived);
}
