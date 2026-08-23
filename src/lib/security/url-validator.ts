/**
 * Production Hardening Phase 3: Security
 * 
 * URL validation and SSRF (Server-Side Request Forgery) protection.
 * Prevents the application from fetching internal/private network resources.
 */

/**
 * Result of URL validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

/**
 * Blocked IP ranges for SSRF protection
 */
const BLOCKED_IP_RANGES = [
  // Private IPv4 ranges
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  // Loopback
  "127.0.0.0/8",
  "::1/128",
  // Link-local
  "169.254.0.0/16",
  "fe80::/10",
  // Documentation
  "192.0.2.0/24",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "2001:db8::/32",
];

/**
 * Allowed URL schemes
 */
const ALLOWED_SCHEMES = ["http", "https"];

/**
 * Blocked domains (internal services)
 */
const BLOCKED_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254",
];

/**
 * Check if an IP address is in a CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const [network, prefixLength] = cidr.split("/");
  const prefix = parseInt(prefixLength, 10);
  
  // Simple implementation for IPv4
  if (ip.includes(".")) {
    const ipParts = ip.split(".").map(Number);
    const networkParts = network.split(".").map(Number);
    const mask = 0xFFFFFFFF << (32 - prefix);
    
    const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
    const networkNum = (networkParts[0] << 24) | (networkParts[1] << 16) | (networkParts[2] << 8) | networkParts[3];
    
    return (ipNum & mask) === (networkNum & mask);
  }
  
  // For IPv6, return false for now (needs more complex implementation)
  return false;
}

/**
 * Check if an IP address is in any blocked range
 */
function isBlockedIp(ip: string): boolean {
  return BLOCKED_IP_RANGES.some(range => isIpInCidr(ip, range));
}

/**
 * Check if a hostname is a blocked domain
 */
function isBlockedDomain(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();
  return BLOCKED_DOMAINS.some(blocked => lowerHostname === blocked || lowerHostname.endsWith(`.${blocked}`));
}

/**
 * Resolve hostname to IP addresses (placeholder - in production, use DNS resolution)
 */
async function resolveHostname(_hostname: string): Promise<string[]> {
  // TODO: Implement actual DNS resolution
  // For now, return empty to skip IP checks
  // In production, use dns.lookup() or similar
  return [];
}

/**
 * Validate a URL for SSRF protection
 */
export async function validateUrl(url: string): Promise<ValidationResult> {
  try {
    // Parse URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { valid: false, error: "Invalid URL format" };
    }

    // Check scheme
    if (!ALLOWED_SCHEMES.includes(parsedUrl.protocol.replace(":", ""))) {
      return { valid: false, error: `URL scheme not allowed: ${parsedUrl.protocol}` };
    }

    // Check hostname
    const hostname = parsedUrl.hostname;
    
    // Check for blocked domains
    if (isBlockedDomain(hostname)) {
      return { valid: false, error: "Blocked domain (internal/private)" };
    }

    // Resolve hostname to IPs and check blocked ranges
    const ips = await resolveHostname(hostname);
    for (const ip of ips) {
      if (isBlockedIp(ip)) {
        return { valid: false, error: `Blocked IP address: ${ip}` };
      }
    }

    // Check for port redirection attempts
    if (parsedUrl.port) {
      const port = parseInt(parsedUrl.port, 10);
      // Block common internal service ports
      const blockedPorts = [22, 23, 25, 53, 3306, 5432, 6379, 27017];
      if (blockedPorts.includes(port)) {
        return { valid: false, error: `Blocked port: ${port}` };
      }
    }

    // Sanitize URL by removing credentials
    const sanitizedUrl = new URL(url);
    sanitizedUrl.username = "";
    sanitizedUrl.password = "";

    return { valid: true, sanitizedUrl: sanitizedUrl.toString() };
  } catch {
    return { valid: false, error: "URL validation failed" };
  }
}

/**
 * Validate multiple URLs
 */
export async function validateUrls(urls: string[]): Promise<ValidationResult[]> {
  return Promise.all(urls.map(validateUrl));
}

/**
 * Quick synchronous check for obviously invalid URLs
 * Use this before async validation for early rejection
 */
export function quickValidateUrl(url: string): ValidationResult {
  try {
    const parsed = new URL(url);
    
    // Check scheme
    if (!ALLOWED_SCHEMES.includes(parsed.protocol.replace(":", ""))) {
      return { valid: false, error: `URL scheme not allowed: ${parsed.protocol}` };
    }

    // Check for blocked domains
    if (isBlockedDomain(parsed.hostname)) {
      return { valid: false, error: "Blocked domain (internal/private)" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}
