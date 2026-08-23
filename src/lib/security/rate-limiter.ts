/**
 * Production Hardening Phase 3: Security
 * 
 * API rate limiting to prevent abuse and protect resources.
 * Uses in-memory storage (for production, use Redis or similar).
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  skipSuccessfulRequests?: boolean; // Only count failed requests
  skipFailedRequests?: boolean; // Only count successful requests
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when limit resets
}

/**
 * In-memory rate limit store
 * In production, replace with Redis or similar
 */
class RateLimitStore {
  private store: Map<string, { count: number; reset: number }> = new Map();

  get(key: string): { count: number; reset: number } | undefined {
    return this.store.get(key);
  }

  set(key: string, value: { count: number; reset: number }): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of Array.from(this.store.entries())) {
      if (value.reset < now) {
        this.store.delete(key);
      }
    }
  }
}

const store = new RateLimitStore();

// Run cleanup every minute
if (typeof setInterval !== "undefined") {
  setInterval(() => store.cleanup(), 60000);
}

/**
 * Check if a request is within rate limits
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();

  let entry = store.get(identifier);
  
  // Reset if window expired
  if (!entry || entry.reset < now) {
    entry = { count: 0, reset: now + config.windowMs };
    store.set(identifier, entry);
  }
  
  entry.count++;
  store.set(identifier, entry);
  
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;
  
  return {
    allowed,
    limit: config.maxRequests,
    remaining,
    reset: entry.reset,
  };
}

/**
 * Rate limit middleware for API routes
 */
export function rateLimit(config: RateLimitConfig) {
  return (identifier: string): RateLimitResult => {
    return checkRateLimit(identifier, config);
  };
}

/**
 * Get rate limit key from request
 * Uses IP address or user ID if available
 */
export function getRateLimitKey(
  ip?: string,
  userId?: string,
  endpoint?: string
): string {
  const parts = [];
  
  if (userId) {
    parts.push(`user:${userId}`);
  } else if (ip) {
    parts.push(`ip:${ip}`);
  }
  
  if (endpoint) {
    parts.push(endpoint);
  }
  
  return parts.join(":");
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Strict limits for public endpoints
  public: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  
  // Moderate limits for authenticated users
  authenticated: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
  },
  
  // Strict limits for expensive operations
  expensive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },
  
  // Very strict limits for investigation creation
  investigationCreate: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 5,
  },
  
  // Marketplace submission limits
  marketplaceSubmit: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
  },
  
  // API key usage limits
  apiKey: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5000,
  },
} as const;

/**
 * Check rate limit for a specific endpoint type
 */
export function checkEndpointRateLimit(
  identifier: string,
  endpointType: keyof typeof RATE_LIMITS
): RateLimitResult {
  return checkRateLimit(identifier, RATE_LIMITS[endpointType]);
}

/**
 * Reset rate limit for a specific identifier (admin use)
 */
export function resetRateLimit(identifier: string): void {
  store.delete(identifier);
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(identifier: string): RateLimitResult | null {
  const entry = store.get(identifier);
  if (!entry) {
    return null;
  }
  
  return {
    allowed: true,
    limit: 100, // Default limit
    remaining: Math.max(0, 100 - entry.count),
    reset: entry.reset,
  };
}
