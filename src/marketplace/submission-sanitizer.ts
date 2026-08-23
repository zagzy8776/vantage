/**
 * Production Hardening Phase 3: Security
 * 
 * Researcher submission sanitization for XSS prevention.
 * Sanitizes marketplace task applications and submissions.
 */

import {
  sanitizeString,
  sanitizeUrl,
  containsXss,
  deepSanitize,
  type SanitizeOptions,
} from "@/lib/security/input-sanitizer";

/**
 * Marketplace task application input
 */
export interface TaskApplicationInput {
  taskId: string;
  coverLetter: string;
  qualifications: string[];
  proposedTimeline: string;
}

/**
 * Marketplace task submission input
 */
export interface TaskSubmissionInput {
  taskId: string;
  applicationId: string;
  evidence: string;
  findings: string;
  sources: string[];
}

/**
 * Sanitization options for marketplace submissions
 */
const SUBMISSION_SANITIZE_OPTIONS: SanitizeOptions = {
  maxLength: 50000, // 50KB max for submissions
  allowHtml: false, // No HTML allowed
  trim: true,
  removeNullBytes: true,
};

/**
 * Sanitize a task application
 */
export function sanitizeTaskApplication(input: TaskApplicationInput): TaskApplicationInput {
  // Check for XSS patterns on RAW input BEFORE sanitization.
  // Sanitization strips dangerous content silently; explicit rejection
  // prevents attackers from probing with payloads that get quietly removed.
  if (containsXss(input.coverLetter)) {
    throw new Error("Cover letter contains potentially malicious content");
  }

  for (const q of input.qualifications) {
    if (containsXss(q)) {
      throw new Error("Qualifications contain potentially malicious content");
    }
  }

  if (containsXss(input.proposedTimeline)) {
    throw new Error("Proposed timeline contains potentially malicious content");
  }

  const sanitized: TaskApplicationInput = {
    taskId: input.taskId,
    coverLetter: sanitizeString(input.coverLetter, SUBMISSION_SANITIZE_OPTIONS),
    qualifications: input.qualifications.map(q =>
      sanitizeString(q, { ...SUBMISSION_SANITIZE_OPTIONS, maxLength: 500 })
    ),
    proposedTimeline: sanitizeString(input.proposedTimeline, {
      ...SUBMISSION_SANITIZE_OPTIONS,
      maxLength: 1000,
    }),
  };

  return sanitized;
}

/**
 * Sanitize a task submission
 */
export function sanitizeTaskSubmission(input: TaskSubmissionInput): TaskSubmissionInput {
  // Check for XSS patterns on RAW input BEFORE sanitization
  if (containsXss(input.evidence)) {
    throw new Error("Evidence contains potentially malicious content");
  }

  if (containsXss(input.findings)) {
    throw new Error("Findings contains potentially malicious content");
  }

  for (const source of input.sources) {
    if (containsXss(source)) {
      throw new Error("Sources contain potentially malicious content");
    }
  }

  const sanitized: TaskSubmissionInput = {
    taskId: input.taskId,
    applicationId: input.applicationId,
    evidence: sanitizeString(input.evidence, SUBMISSION_SANITIZE_OPTIONS),
    findings: sanitizeString(input.findings, SUBMISSION_SANITIZE_OPTIONS),
    sources: input.sources.map(s => sanitizeUrl(s)),
  };

  return sanitized;
}

/**
 * Validate that a URL is safe for marketplace sources
 */
export function validateMarketplaceUrl(url: string): { valid: boolean; error?: string } {
  try {
    // Check for XSS patterns first
    if (containsXss(url)) {
      return { valid: false, error: "URL contains potentially malicious content" };
    }

    const sanitized = sanitizeUrl(url);
    
    // Basic validation
    if (!sanitized.startsWith("http://") && !sanitized.startsWith("https://")) {
      return { valid: false, error: "URL must use HTTP or HTTPS protocol" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

/**
 * Sanitize an array of marketplace source URLs
 */
export function sanitizeMarketplaceSources(urls: string[]): string[] {
  return urls.map(url => {
    const validation = validateMarketplaceUrl(url);
    if (!validation.valid) {
      throw new Error(`Invalid source URL: ${validation.error}`);
    }
    return sanitizeUrl(url);
  });
}

/**
 * Deep sanitize any marketplace submission data
 */
export function sanitizeMarketplaceData<T>(data: T): T {
  return deepSanitize(data, SUBMISSION_SANITIZE_OPTIONS) as T;
}

/**
 * Check if text is safe for display (no XSS)
 */
export function isSafeForDisplay(text: string): boolean {
  return !containsXss(text);
}

/**
 * Sanitize text for safe display in HTML context
 * Escapes HTML entities to prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "/": "&#x2F;",
  };

  return text.replace(/[&<>"'/]/g, char => map[char]);
}

/**
 * Sanitize text for safe display in JavaScript context
 */
export function escapeJavaScript(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\f/g, "\\f");
}

/**
 * Sanitize text for safe display in URL context
 */
export function escapeUrl(text: string): string {
  return encodeURIComponent(text);
}

/**
 * Validate marketplace task description
 */
export function validateTaskDescription(description: string): { valid: boolean; error?: string } {
  if (description.length > 10000) {
    return { valid: false, error: "Description too long (max 10000 characters)" };
  }

  if (containsXss(description)) {
    return { valid: false, error: "Description contains potentially malicious content" };
  }

  return { valid: true };
}

/**
 * Sanitize marketplace task description
 */
export function sanitizeTaskDescription(description: string): string {
  const validation = validateTaskDescription(description);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return sanitizeString(description, {
    maxLength: 10000,
    allowHtml: false,
    trim: true,
  });
}
