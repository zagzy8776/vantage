/**
 * Signup input validation - pure functions shared by the signup API route
 * and unit tests. Server-side validation is authoritative; client checks
 * are convenience only.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

/**
 * Validate a signup payload. Returns a list of user-facing error messages -
 * empty means valid. Never throws; never echoes password material.
 */
export function validateSignupInput(input: Partial<SignupInput>): string[] {
  const errors: string[] = [];

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) errors.push("Full name is required.");
  else if (name.length > 100) errors.push("Full name must be 100 characters or fewer.");

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email) errors.push("Email is required.");
  else if (!EMAIL_PATTERN.test(email)) errors.push("Enter a valid email address.");
  else if (email.length > 254) errors.push("Email address is too long.");

  const password = typeof input.password === "string" ? input.password : "";
  const strengthErrors = validatePasswordStrength(password);
  errors.push(...strengthErrors);

  if (
    input.confirmPassword !== undefined &&
    password.length > 0 &&
    password !== input.confirmPassword
  ) {
    errors.push("Passwords do not match.");
  }

  return errors;
}

/**
 * Password strength policy: minimum 8 characters with upper, lower, digit.
 */
export function validatePasswordStrength(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long.");
    return errors;
  }
  if (!/[a-z]/.test(password)) errors.push("Password must include a lowercase letter.");
  if (!/[A-Z]/.test(password)) errors.push("Password must include an uppercase letter.");
  if (!/\d/.test(password)) errors.push("Password must include a number.");
  return errors;
}

/**
 * Mask an email for display on the verify page:
 * "zachary.example@company.co" -> "z***@company.co"
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  return `${local[0]}***@${email.slice(at + 1)}`;
}
