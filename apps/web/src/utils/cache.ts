/**
 * Caching utilities for API responses and static data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private timers = new Map<string, NodeJS.Timeout>();

  /**
   * Get cached data if valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache entry with TTL
   */
  set<T>(key: string, data: T, ttl: number = 60000): void {
    // Clear existing timer if any
    this.clearTimer(key);

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Set auto-cleanup timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);
    this.timers.set(key, timer);
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.clearTimer(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clear expired entries
   */
  pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.delete(key);
      }
    }
  }

  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}

// Global cache instance
export const apiCache = new CacheManager();

// Cache key generators
export const cacheKeys = {
  user: (id: string) => `user:${id}`,
  track: (id: string) => `track:${id}`,
  tracks: (userId: string) => `tracks:user:${userId}`,
  marketplace: (page: number, filters?: string) => `marketplace:${page}:${filters || 'all'}`,
  seller: (id: string) => `seller:${id}`,
  playlist: (id: string) => `playlist:${id}`,
  backgroundMusic: (category?: string) => `bgmusic:${category || 'all'}`,
};

// Cache TTL configurations (in milliseconds)
export const cacheTTL = {
  short: 30 * 1000, // 30 seconds
  medium: 5 * 60 * 1000, // 5 minutes
  long: 30 * 60 * 1000, // 30 minutes
  hour: 60 * 60 * 1000, // 1 hour
  day: 24 * 60 * 60 * 1000, // 1 day
};

// Memoization decorator for async functions
export function memoize<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string,
  ttl: number = cacheTTL.medium
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    const cached = apiCache.get(key);

    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    apiCache.set(key, result, ttl);
    return result;
  }) as T;
}

// Stale-while-revalidate pattern
export async function swr<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    staleTime?: number;
    onError?: (error: Error) => void;
  } = {}
): Promise<T> {
  const { ttl = cacheTTL.medium, staleTime = ttl / 2, onError } = options;

  const cached = apiCache.get<{ data: T; fetchedAt: number }>(key);

  if (cached) {
    const age = Date.now() - cached.fetchedAt;

    // Return cached data if fresh
    if (age < staleTime) {
      return cached.data;
    }

    // Return stale data and revalidate in background
    fetcher()
      .then((data) => {
        apiCache.set(key, { data, fetchedAt: Date.now() }, ttl);
      })
      .catch((error) => {
        if (onError) onError(error);
      });

    return cached.data;
  }

  // No cache, fetch and store
  try {
    const data = await fetcher();
    apiCache.set(key, { data, fetchedAt: Date.now() }, ttl);
    return data;
  } catch (error) {
    if (onError) onError(error as Error);
    throw error;
  }
}

// React hook for cache invalidation
export function useCacheInvalidation() {
  return {
    invalidate: (key: string) => apiCache.delete(key),
    invalidatePattern: (pattern: string) => {
      // Invalidate all keys matching pattern
      for (const key of apiCache['cache'].keys()) {
        if (key.includes(pattern)) {
          apiCache.delete(key);
        }
      }
    },
    clearAll: () => apiCache.clear(),
  };
}

// Local storage cache for persistent data
export class PersistentCache {
  private prefix: string;

  constructor(prefix: string = 'mindscript') {
    this.prefix = prefix;
  }

  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const item = localStorage.getItem(`${this.prefix}:${key}`);
      if (!item) return null;

      const { data, expires } = JSON.parse(item);
      if (expires && Date.now() > expires) {
        this.delete(key);
        return null;
      }

      return data as T;
    } catch {
      return null;
    }
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (typeof window === 'undefined') return;

    try {
      const item = {
        data,
        expires: ttl ? Date.now() + ttl : null,
      };
      localStorage.setItem(`${this.prefix}:${key}`, JSON.stringify(item));
    } catch (e) {
      // Handle quota exceeded
      console.warn('LocalStorage quota exceeded, clearing old entries');
      this.pruneOldest();
    }
  }

  delete(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${this.prefix}:${key}`);
  }

  clear(): void {
    if (typeof window === 'undefined') return;

    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  private pruneOldest(): void {
    if (typeof window === 'undefined') return;

    const items: { key: string; expires: number }[] = [];
    const keys = Object.keys(localStorage);

    keys.forEach((key) => {
      if (key.startsWith(this.prefix)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (item.expires) {
            items.push({ key, expires: item.expires });
          }
        } catch {}
      }
    });

    // Sort by expiration and remove oldest 25%
    items.sort((a, b) => a.expires - b.expires);
    const toRemove = Math.ceil(items.length * 0.25);
    items.slice(0, toRemove).forEach(({ key }) => {
      localStorage.removeItem(key);
    });
  }
}

export const persistentCache = new PersistentCache();