import { NextRequest } from "next/server";

/**
 * Simple in-memory rate limiter for development
 * In production, use Redis or a proper rate limiting service
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage (would be Redis in production)
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

/**
 * Rate limiter implementation
 */
export function rateLimit({
  windowMs,
  max,
  keyGenerator = (req) => getClientIP(req)
}: RateLimitOptions) {
  return (req: NextRequest): RateLimitResult => {
    const key = keyGenerator(req);
    const now = Date.now();
    const resetTime = now + windowMs;

    let entry = store.get(key);

    // Create new entry if doesn't exist or expired
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime
      };
      store.set(key, entry);
      
      return {
        allowed: true,
        remaining: max - 1,
        resetTime,
        totalHits: 1
      };
    }

    // Increment count
    entry.count++;

    const allowed = entry.count <= max;
    const remaining = Math.max(0, max - entry.count);

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
      totalHits: entry.count
    };
  };
}

/**
 * Get client IP from request
 */
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp.trim();
  }

  // Fallback to connection info (may not be available in all environments)
  return req.ip || 'unknown';
}

/**
 * Create user-specific rate limiter
 */
export function createUserRateLimit(userId: string, options: RateLimitOptions) {
  return rateLimit({
    ...options,
    keyGenerator: () => `user:${userId}`
  });
}

/**
 * Rate limit responses for different operations
 */
export const RATE_LIMITS = {
  render: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 renders per hour per user
  },
  status: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 status checks per minute
  },
  download: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 downloads per 5 minutes
  },
  cancel: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 cancellations per minute
  },
} as const;