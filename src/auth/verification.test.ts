import { describe, it, expect } from "vitest";
import {
  generateVerificationCode,
  hashCodeVerification,
  evaluateVerification,
  isResendAllowed,
  secondsUntilExpiry,
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
} from "./verification";

function makeRecord(overrides?: Partial<Parameters<typeof evaluateVerification>[0]>) {
  return {
    codeHash: hashCodeVerification("123456"),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    attempts: 0,
    verifiedAt: null,
    ...overrides,
  };
}

describe("verification code generation", () => {
  it("produces 6-digit numeric codes", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("is not constant across draws (CSPRNG entropy)", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateVerificationCode()));
    expect(codes.size).toBeGreaterThan(90);
  });
});

describe("verification code hashing", () => {
  it("never stores the plaintext code", () => {
    const hash = hashCodeVerification("654321");
    expect(hash).not.toBe("654321");
    expect(hash).not.toContain("654321");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for the same code (comparable)", () => {
    expect(hashCodeVerification("111111")).toBe(hashCodeVerification("111111"));
  });

  it("differs between different codes", () => {
    expect(hashCodeVerification("111111")).not.toBe(hashCodeVerification("111112"));
  });
});

describe("evaluateVerification", () => {
  it("accepts the correct code", () => {
    expect(evaluateVerification(makeRecord(), "123456")).toBe("ok");
  });

  it("rejects an incorrect code", () => {
    expect(evaluateVerification(makeRecord(), "654321")).toBe("invalid");
  });

  it("rejects non-numeric or malformed input", () => {
    expect(evaluateVerification(makeRecord(), "abcdef")).toBe("invalid");
    expect(evaluateVerification(makeRecord(), "12 456")).toBe("invalid");
    expect(evaluateVerification(makeRecord(), "")).toBe("invalid");
  });

  it("rejects an expired code even if correct", () => {
    const record = makeRecord({ expiresAt: new Date(Date.now() - 1) });
    expect(evaluateVerification(record, "123456")).toBe("expired");
  });

  it("rejects when max attempts are exhausted", () => {
    const record = makeRecord({ attempts: MAX_ATTEMPTS });
    expect(evaluateVerification(record, "123456")).toBe("too_many_attempts");
  });

  it("rejects an already-verified record", () => {
    const record = makeRecord({ verifiedAt: new Date() });
    expect(evaluateVerification(record, "123456")).toBe("invalid");
  });

  it("enforces expiry before correctness (no oracle)", () => {
    const record = makeRecord({
      expiresAt: new Date(Date.now() - 1),
      codeHash: hashCodeVerification("000000"),
    });
    expect(evaluateVerification(record, "999999")).toBe("expired");
  });
});

describe("resend cooldown", () => {
  it("blocks resends within the cooldown window", () => {
    expect(isResendAllowed(new Date(Date.now() - RESEND_COOLDOWN_MS / 2))).toBe(false);
  });

  it("allows resends after the cooldown window", () => {
    expect(isResendAllowed(new Date(Date.now() - RESEND_COOLDOWN_MS - 1000))).toBe(true);
  });
});

describe("secondsUntilExpiry", () => {
  it("counts down to zero and never goes negative", () => {
    expect(secondsUntilExpiry(new Date(Date.now() + 30_000))).toBe(30);
    expect(secondsUntilExpiry(new Date(Date.now() - 500_000))).toBe(0);
  });
});
