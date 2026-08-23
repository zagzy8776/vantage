/**
 * Production Hardening Phase 3: Security
 * 
 * Input validation and sanitization to prevent XSS, injection attacks,
 * and other malicious input.
 */

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  maxLength?: number;
  allowHtml?: boolean;
  trim?: boolean;
  removeNullBytes?: boolean;
}

/**
 * Sanitize a string input
 */
export function sanitizeString(input: string, options: SanitizeOptions = {}): string {
  const {
    maxLength = 10000,
    allowHtml = false,
    trim = true,
    removeNullBytes = true,
  } = options;

  let sanitized = input;

  // Remove null bytes
  if (removeNullBytes) {
    sanitized = sanitized.replace(/\0/g, "");
  }

  // Trim whitespace
  if (trim) {
    sanitized = sanitized.trim();
  }

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove HTML if not allowed
  if (!allowHtml) {
    sanitized = stripHtml(sanitized);
  }

  return sanitized;
}

/**
 * Strip HTML tags from a string
 */
function stripHtml(input: string): string {
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Sanitize an email address
 */
export function sanitizeEmail(email: string): string {
  const sanitized = email.trim().toLowerCase();
  const maxLength = 254; // RFC 5321 max length
  return sanitized.substring(0, maxLength);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const sanitized = sanitizeEmail(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized);
}

/**
 * Sanitize a phone number
 */
export function sanitizePhone(phone: string): string {
  // Keep only digits, +, -, (, ), and space
  return phone.replace(/[^\d\+\-\(\)\s]/g, "").trim();
}

/**
 * Sanitize a URL (basic validation, not SSRF protection)
 */
export function sanitizeUrl(url: string): string {
  return url.trim().substring(0, 2048);
}

/**
 * Sanitize an ID (alphanumeric, hyphens, underscores)
 */
export function sanitizeId(id: string): string {
  // Keep only alphanumeric, hyphen, underscore
  return id.replace(/[^a-zA-Z0-9\-_]/g, "").trim();
}

/**
 * Sanitize text for database queries (basic SQL injection prevention)
 * Note: This is NOT a replacement for parameterized queries
 */
export function sanitizeForSql(input: string): string {
  return input
    .replace(/'/g, "''")
    .replace(/\\/g, "\\\\")
    .replace(/\x00/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z");
}

/**
 * Sanitize JSON input
 */
export function sanitizeJson(input: string): string {
  try {
    // Try to parse as JSON to validate structure
    JSON.parse(input);
    return input;
  } catch {
    // If invalid JSON, return empty object
    return "{}";
  }
}

/**
 * Sanitize an array of strings
 */
export function sanitizeStringArray(input: string[], options: SanitizeOptions = {}): string[] {
  return input.map(item => sanitizeString(item, options));
}

/**
 * Sanitize an object's string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  input: T,
  options: SanitizeOptions = {}
): T {
  const sanitized = { ...input };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === "string") {
      sanitized[key] = sanitizeString(sanitized[key] as string, options) as T[Extract<keyof T, string>];
    } else if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeStringArray(sanitized[key] as string[], options) as T[Extract<keyof T, string>];
    }
  }
  
  return sanitized;
}

/**
 * Validate and sanitize a numeric input
 */
export function sanitizeNumber(input: string | number, min?: number, max?: number): number {
  const num = typeof input === "number" ? input : parseFloat(input);
  
  if (isNaN(num)) {
    return 0;
  }
  
  if (min !== undefined && num < min) {
    return min;
  }
  
  if (max !== undefined && num > max) {
    return max;
  }
  
  return num;
}

/**
 * Sanitize a boolean input
 */
export function sanitizeBoolean(input: unknown): boolean {
  if (typeof input === "boolean") {
    return input;
  }
  
  if (typeof input === "string") {
    const lower = input.toLowerCase();
    return lower === "true" || lower === "1" || lower === "yes";
  }
  
  if (typeof input === "number") {
    return input !== 0;
  }
  
  return false;
}

/**
 * Sanitize a date string
 */
export function sanitizeDate(input: string): Date | null {
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Check for common XSS patterns
 */
export function containsXss(input: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /onclick=/i,
    /onmouseover=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\(/i,
    /expression\(/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Deep sanitize any input
 */
export function deepSanitize(input: unknown, options: SanitizeOptions = {}): unknown {
  if (typeof input === "string") {
    return sanitizeString(input, options);
  }
  
  if (Array.isArray(input)) {
    return input.map(item => deepSanitize(item, options));
  }
  
  if (typeof input === "object" && input !== null) {
    const source = input as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      sanitized[key] = deepSanitize(source[key], options);
    }
    return sanitized;
  }
  
  return input;
}
