/**
 * Simple in-memory rate limiter for API routes.
 * In production, consider Redis-based rate limiting for multi-instance deployments.
 */

interface RateLimitConfig {
  max: number
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

const store = new Map<string, { count: number; resetTime: number }>()

export const RATE_LIMITS = {
  status: { max: 60, windowMs: 60_000 },    // 60 requests per minute
  cancel: { max: 10, windowMs: 60_000 },    // 10 cancels per minute
  download: { max: 20, windowMs: 60_000 },  // 20 downloads per minute
  default: { max: 30, windowMs: 60_000 },   // 30 requests per minute
} as const

export function createUserRateLimit(
  userId: string,
  config: RateLimitConfig
): (request: Request) => RateLimitResult {
  return () => {
    const key = `${userId}:${config.max}:${config.windowMs}`
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now >= entry.resetTime) {
      const resetTime = now + config.windowMs
      store.set(key, { count: 1, resetTime })
      return { allowed: true, remaining: config.max - 1, resetTime }
    }

    entry.count++
    const remaining = Math.max(0, config.max - entry.count)

    if (entry.count > config.max) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime }
    }

    return { allowed: true, remaining, resetTime: entry.resetTime }
  }
}
