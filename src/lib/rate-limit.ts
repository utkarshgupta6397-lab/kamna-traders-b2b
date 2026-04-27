type RateLimitInfo = { count: number; expiresAt: number };
const rateLimiter = new Map<string, RateLimitInfo>();

/**
 * Basic in-memory rate limiter.
 * @param key Unique identifier (e.g., action + IP address)
 * @param limit Maximum number of requests allowed in the window
 * @param windowMs Time window in milliseconds
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const info = rateLimiter.get(key);

  if (!info || now > info.expiresAt) {
    rateLimiter.set(key, { count: 1, expiresAt: now + windowMs });
    return true; // Allowed
  }

  if (info.count >= limit) {
    return false; // Blocked (Rate Limited)
  }

  info.count++;
  return true; // Allowed
}
