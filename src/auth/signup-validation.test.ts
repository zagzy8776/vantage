import { describe, it, expect } from "vitest";
import { validateSignupInput, validatePasswordStrength, maskEmail } from "./signup-validation";

const VALID = { name: "Jane Founder", email: "jane@company.com", password: "Sunset9Sky", confirmPassword: "Sunset9Sky" };

describe("signup validation", () => {
  it("accepts a fully valid signup", () => {
    expect(validateSignupInput(VALID)).toEqual([]);
  });

  it("requires a name", () => {
    expect(validateSignupInput({ ...VALID, name: "   " })).toContain("Full name is required.");
  });

  it("rejects an invalid email", () => {
    expect(validateSignupInput({ ...VALID, email: "not-an-email" })).toContain(
      "Enter a valid email address."
    );
    expect(validateSignupInput({ ...VALID, email: "missing@tld" })).toContain(
      "Enter a valid email address."
    );
  });

  it("rejects weak passwords", () => {
    const tooShort = validatePasswordStrength("short1A");
    expect(tooShort.some((e) => e.includes("at least 8 characters"))).toBe(true);

    const noUpper = validatePasswordStrength("alllowercase1");
    expect(noUpper.some((e) => e.includes("uppercase"))).toBe(true);

    const noLower = validatePasswordStrength("ALLUPPERCASE1");
    expect(noLower.some((e) => e.includes("lowercase"))).toBe(true);

    const noDigit = validatePasswordStrength("NoDigitsHere");
    expect(noDigit.some((e) => e.includes("number"))).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    expect(validateSignupInput({ ...VALID, confirmPassword: "Different1" })).toContain(
      "Passwords do not match."
    );
  });

  it("normalizes whitespace-only input to errors", () => {
    const errors = validateSignupInput({});
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("maskEmail", () => {
  it("masks the local part for display", () => {
    expect(maskEmail("zachary@company.co")).toBe("z***@company.co");
  });

  it("degrades safely for malformed emails", () => {
    expect(maskEmail("no-at-sign")).toBe("***");
  });
});
