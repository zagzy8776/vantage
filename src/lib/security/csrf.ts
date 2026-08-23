/**
 * Production Hardening Phase 3: Security
 * 
 * CSRF (Cross-Site Request Forgery) protection for state-changing operations.
 * Generates and validates CSRF tokens for API requests.
 */

import { randomBytes } from "crypto";

/**
 * CSRF token configuration
 */
export interface CsrfConfig {
  secret: string;
  saltLength?: number;
  tokenLength?: number;
}

/**
 * CSRF token with metadata
 */
export interface CsrfToken {
  token: string;
  expiresAt: number;
}

/**
 * In-memory token store (for production, use Redis or database)
 */
class CsrfTokenStore {
  private store: Map<string, { expiresAt: number }> = new Map();

  set(token: string, expiresAt: number): void {
    this.store.set(token, { expiresAt });
  }

  has(token: string): boolean {
    const entry = this.store.get(token);
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.store.delete(token);
      return false;
    }
    
    return true;
  }

  delete(token: string): void {
    this.store.delete(token);
  }

  // Clean up expired tokens
  cleanup(): void {
    const now = Date.now();
    for (const [token, entry] of Array.from(this.store.entries())) {
      if (entry.expiresAt < now) {
        this.store.delete(token);
      }
    }
  }
}

const tokenStore = new CsrfTokenStore();

// Run cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => tokenStore.cleanup(), 5 * 60 * 1000);
}

/**
 * Generate a random string
 */
function randomString(length: number): string {
  return randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

/**
 * Create a CSRF token
 */
export function createCsrfToken(config: CsrfConfig, expiresIn: number = 3600000): CsrfToken {
  const saltLength = config.saltLength || 16;
  const tokenLength = config.tokenLength || 32;
  
  const salt = randomString(saltLength);
  const token = randomString(tokenLength);
  
  // In production, you would sign the token with the secret
  // For now, we'll use a simple approach
  const signedToken = `${salt}.${token}`;
  
  const expiresAt = Date.now() + expiresIn;
  tokenStore.set(signedToken, expiresAt);
  
  return {
    token: signedToken,
    expiresAt,
  };
}

/**
 * Validate a CSRF token
 */
export function validateCsrfToken(token: string, _config: CsrfConfig): boolean {
  // Check if token exists in store
  if (!tokenStore.has(token)) {
    return false;
  }
  
  // In production, verify the signature using the secret
  // For now, we just check existence
  
  return true;
}

/**
 * Invalidate a CSRF token after use
 */
export function invalidateCsrfToken(token: string): void {
  tokenStore.delete(token);
}

/**
 * Generate CSRF token for API response
 * Returns token that should be sent to client
 */
export function generateCsrfTokenForClient(secret: string): string {
  const config: CsrfConfig = { secret };
  const { token } = createCsrfToken(config);
  return token;
}

/**
 * Validate CSRF token from client request
 */
export function validateCsrfTokenFromClient(token: string, secret: string): boolean {
  const config: CsrfConfig = { secret };
  return validateCsrfToken(token, config);
}

/**
 * Middleware to check CSRF token
 * For use in API routes
 */
export function requireCsrfToken(request: Request, secret: string): boolean {
  // Check header
  const csrfHeader = request.headers.get("x-csrf-token");
  if (csrfHeader && validateCsrfTokenFromClient(csrfHeader, secret)) {
    return true;
  }
  
  // Check body (for non-GET requests)
  return false;
}

/**
 * Add CSRF token to response headers
 */
export function addCsrfTokenToHeaders(headers: Headers, token: string): void {
  headers.set("x-csrf-token", token);
}

/**
 * State-changing methods that require CSRF protection
 */
export const CSRF_PROTECTED_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Check if request method requires CSRF protection
 */
export function requiresCsrfProtection(method: string): boolean {
  return CSRF_PROTECTED_METHODS.includes(method.toUpperCase());
}

/**
 * Safe methods that don't require CSRF protection
 */
export const CSRF_SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

/**
 * Check if request method is safe (doesn't require CSRF)
 */
export function isSafeMethod(method: string): boolean {
  return CSRF_SAFE_METHODS.includes(method.toUpperCase());
}
