/**
 * Production Hardening Phase 3: Security
 * 
 * Secret management utility.
 * Loads secrets from environment variables and provides type-safe access.
 * Prevents accidental logging of secrets.
 */

/**
 * Required secret configuration
 */
export interface SecretConfig {
  name: string;
  required: boolean;
  description: string;
}

/**
 * Secret definitions for the application
 */
export const SECRET_DEFINITIONS: Record<string, SecretConfig> = {
  // Database
  DATABASE_URL: {
    name: "DATABASE_URL",
    required: true,
    description: "PostgreSQL database connection string",
  },
  
  // API Keys
  FIRECRAWL_API_KEY: {
    name: "FIRECRAWL_API_KEY",
    required: false,
    description: "Firecrawl API key for web scraping",
  },
  
  PAGESPEED_API_KEY: {
    name: "PAGESPEED_API_KEY",
    required: false,
    description: "Google PageSpeed Insights API key",
  },
  
  OPENAI_API_KEY: {
    name: "OPENAI_API_KEY",
    required: false,
    description: "OpenAI API key for AI operations",
  },
  
  ANTHROPIC_API_KEY: {
    name: "ANTHROPIC_API_KEY",
    required: false,
    description: "Anthropic API key for AI operations",
  },
  
  // Authentication
  JWT_SECRET: {
    name: "JWT_SECRET",
    required: true,
    description: "Secret key for JWT token signing",
  },
  
  CSRF_SECRET: {
    name: "CSRF_SECRET",
    required: true,
    description: "Secret key for CSRF token generation",
  },
  
  // External Services
  REDIS_URL: {
    name: "REDIS_URL",
    required: false,
    description: "Redis connection string for caching",
  },
  
  // Email
  SMTP_HOST: {
    name: "SMTP_HOST",
    required: false,
    description: "SMTP server host for email sending",
  },
  
  SMTP_PORT: {
    name: "SMTP_PORT",
    required: false,
    description: "SMTP server port",
  },
  
  SMTP_USER: {
    name: "SMTP_USER",
    required: false,
    description: "SMTP username",
  },
  
  SMTP_PASSWORD: {
    name: "SMTP_PASSWORD",
    required: false,
    description: "SMTP password",
  },
  
  // Monitoring
  SENTRY_DSN: {
    name: "SENTRY_DSN",
    required: false,
    description: "Sentry DSN for error tracking",
  },
  
  // Application
  NODE_ENV: {
    name: "NODE_ENV",
    required: true,
    description: "Application environment (development, production, test)",
  },
  
  APP_URL: {
    name: "APP_URL",
    required: true,
    description: "Application base URL",
  },
};

/**
 * Get a secret value from environment variables
 */
export function getSecret(key: string): string | undefined {
  return process.env[key];
}

/**
 * Get a required secret - throws if not present
 */
export function getRequiredSecret(key: string): string {
  const value = getSecret(key);
  if (!value) {
    throw new Error(`Required secret ${key} is not set`);
  }
  return value;
}

/**
 * Get a secret with a default value
 */
export function getSecretWithDefault(key: string, defaultValue: string): string {
  return getSecret(key) || defaultValue;
}

/**
 * Check if all required secrets are present
 */
export function validateSecrets(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const [key, config] of Object.entries(SECRET_DEFINITIONS)) {
    if (config.required && !getSecret(key)) {
      missing.push(key);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get all secret values (for debugging only - never use in production)
 */
export function getAllSecrets(): Record<string, string | undefined> {
  const secrets: Record<string, string | undefined> = {};
  
  for (const key of Object.keys(SECRET_DEFINITIONS)) {
    secrets[key] = getSecret(key);
  }
  
  return secrets;
}

/**
 * Sanitize an object by removing secret values
 * Useful for logging to prevent accidental secret leakage
 */
export function sanitizeSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...obj };
  
  for (const key of Object.keys(sanitized)) {
    const upperKey = key.toUpperCase();
    
    // Check if this key matches any secret definition
    if (SECRET_DEFINITIONS[upperKey]) {
      sanitized[key] = "[REDACTED]";
    }
    
    // Also check for common secret patterns
    if (
      upperKey.includes("PASSWORD") ||
      upperKey.includes("SECRET") ||
      upperKey.includes("API_KEY") ||
      upperKey.includes("TOKEN") ||
      upperKey.includes("PRIVATE")
    ) {
      sanitized[key] = "[REDACTED]";
    }
  }
  
  return sanitized;
}

/**
 * Convert a secret to a safe string representation
 * Returns "[REDACTED]" instead of the actual value
 */
export function redactSecret(_value: string): string {
  return "[REDACTED]";
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Get the current environment
 */
export function getEnvironment(): string {
  return process.env.NODE_ENV || "development";
}

/**
 * Validate that we're not running with default/weak secrets in production
 */
export function validateProductionSecrets(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!isProduction()) {
    return { valid: true, warnings: [] };
  }
  
  // Check for default/weak secrets
  const weakPatterns = [
    "password",
    "secret",
    "123456",
    "changeme",
    "default",
  ];
  
  for (const key of Object.keys(SECRET_DEFINITIONS)) {
    const value = getSecret(key);
    if (value) {
      const lowerValue = value.toLowerCase();
      for (const pattern of weakPatterns) {
        if (lowerValue.includes(pattern)) {
          warnings.push(`Secret ${key} may be using a weak/default value`);
          break;
        }
      }
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}
