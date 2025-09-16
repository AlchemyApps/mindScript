import { unstable_cache } from 'next/cache'

// In-memory cache for development
// In production, you'd use Redis or another cache store
const memoryCache = new Map<string, { data: any; expires: number }>()

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  tags?: string[]
  revalidate?: number
}

/**
 * Cache wrapper for expensive database queries
 * Uses Next.js unstable_cache for production and memory cache for development
 */
export async function cacheQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 300, tags = [], revalidate } = options // Default 5 minutes

  // For production, use Next.js caching
  if (process.env.NODE_ENV === 'production') {
    const cachedFn = unstable_cache(
      fetcher,
      [key],
      {
        tags: ['analytics', ...tags],
        revalidate: revalidate || ttl,
      }
    )
    return cachedFn()
  }

  // For development, use in-memory cache
  const now = Date.now()
  const cached = memoryCache.get(key)

  if (cached && cached.expires > now) {
    console.log(`Cache hit: ${key}`)
    return cached.data
  }

  console.log(`Cache miss: ${key}`)
  const data = await fetcher()

  memoryCache.set(key, {
    data,
    expires: now + (ttl * 1000),
  })

  // Clean up expired entries periodically
  if (Math.random() < 0.1) { // 10% chance
    cleanupCache()
  }

  return data
}

/**
 * Invalidate cache by key or tags
 */
export function invalidateCache(keyOrTags: string | string[]) {
  if (Array.isArray(keyOrTags)) {
    // In production, this would invalidate by tags
    // For now, clear all in memory cache
    memoryCache.clear()
  } else {
    memoryCache.delete(keyOrTags)
  }
}

/**
 * Clear all cache
 */
export function clearCache() {
  memoryCache.clear()
}

/**
 * Clean up expired entries from memory cache
 */
function cleanupCache() {
  const now = Date.now()
  for (const [key, value] of memoryCache.entries()) {
    if (value.expires < now) {
      memoryCache.delete(key)
    }
  }
}

/**
 * Generate cache key from parameters
 */
export function getCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('-')
  return `${prefix}:${sortedParams}`
}