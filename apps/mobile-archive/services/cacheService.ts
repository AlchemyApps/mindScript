import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt?: number;
  size?: number;
  etag?: string;
  version?: string;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  forceRefresh?: boolean;
  offlineFirst?: boolean;
}

interface CacheStats {
  totalSize: number;
  itemCount: number;
  oldestItem: number;
  newestItem: number;
}

class CacheService {
  private static instance: CacheService;
  private readonly CACHE_PREFIX = '@mindscript_cache:';
  private readonly METADATA_PREFIX = '@mindscript_meta:';
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly DEFAULT_TTL = 1000 * 60 * 60 * 24; // 24 hours
  private AUDIO_CACHE_DIR = '';
  private IMAGE_CACHE_DIR = '';

  private constructor() {
    // Initialize cache directories with runtime check
    const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
    if (cacheDir) {
      this.AUDIO_CACHE_DIR = `${cacheDir}audio/`;
      this.IMAGE_CACHE_DIR = `${cacheDir}images/`;
    }
    this.initializeCacheDirectories();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private async initializeCacheDirectories() {
    try {
      // Create cache directories if they don't exist
      const audioDir = await FileSystem.getInfoAsync(this.AUDIO_CACHE_DIR);
      if (!audioDir.exists) {
        await FileSystem.makeDirectoryAsync(this.AUDIO_CACHE_DIR, { intermediates: true });
      }

      const imageDir = await FileSystem.getInfoAsync(this.IMAGE_CACHE_DIR);
      if (!imageDir.exists) {
        await FileSystem.makeDirectoryAsync(this.IMAGE_CACHE_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Failed to initialize cache directories:', error);
    }
  }

  // Check network connectivity
  async isOnline(): Promise<boolean> {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected ?? false;
  }

  // Generic cache methods
  async get<T>(
    key: string,
    fetcher?: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T | null> {
    const { ttl = this.DEFAULT_TTL, forceRefresh = false, offlineFirst = true } = options;
    const cacheKey = this.CACHE_PREFIX + key;

    try {
      // Check if we should use offline-first strategy
      const isOnline = await this.isOnline();

      if (!forceRefresh && (offlineFirst || !isOnline)) {
        // Try to get from cache first
        const cached = await this.getFromCache<T>(cacheKey);

        if (cached && !this.isExpired(cached)) {
          return cached.data;
        }

        // If offline and cache is expired but exists, return stale data
        if (!isOnline && cached) {
          console.warn(`Returning stale cache for ${key} (offline)`);
          return cached.data;
        }
      }

      // If we have a fetcher and we're online (or force refresh), fetch fresh data
      if (fetcher && (isOnline || forceRefresh)) {
        const freshData = await fetcher();
        await this.setCache(cacheKey, freshData, ttl);
        return freshData;
      }

      // Fall back to cache even if expired
      const cached = await this.getFromCache<T>(cacheKey);
      return cached ? cached.data : null;
    } catch (error) {
      console.error(`Cache get error for ${key}:`, error);

      // On error, try to return cached data
      const cached = await this.getFromCache<T>(cacheKey);
      return cached ? cached.data : null;
    }
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const cacheKey = this.CACHE_PREFIX + key;
    await this.setCache(cacheKey, data, ttl || this.DEFAULT_TTL);
  }

  async remove(key: string): Promise<void> {
    const cacheKey = this.CACHE_PREFIX + key;
    try {
      await AsyncStorage.removeItem(cacheKey);
      await AsyncStorage.removeItem(this.METADATA_PREFIX + key);
    } catch (error) {
      console.error(`Failed to remove cache for ${key}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(
        (k) => k.startsWith(this.CACHE_PREFIX) || k.startsWith(this.METADATA_PREFIX)
      );
      await AsyncStorage.multiRemove(cacheKeys);

      // Clear file caches
      await this.clearAudioCache();
      await this.clearImageCache();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // Audio file caching
  async cacheAudioFile(url: string, audioId: string): Promise<string | null> {
    try {
      const filename = `${audioId}.mp3`;
      const localPath = this.AUDIO_CACHE_DIR + filename;

      // Check if already cached
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
        return localPath;
      }

      // Download if online
      if (await this.isOnline()) {
        const downloadResumable = FileSystem.createDownloadResumable(
          url,
          localPath,
          {},
          (downloadProgress) => {
            const progress =
              downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            this.onDownloadProgress?.(audioId, progress);
          }
        );

        const result = await downloadResumable.downloadAsync();
        if (result?.uri) {
          // Store metadata
          await this.set(`audio_meta:${audioId}`, {
            url,
            localPath: result.uri,
            size: result.headers?.['content-length'],
            downloadedAt: Date.now(),
          });

          return result.uri;
        }
      }

      return null;
    } catch (error) {
      console.error(`Failed to cache audio ${audioId}:`, error);
      return null;
    }
  }

  async getAudioFile(audioId: string): Promise<string | null> {
    try {
      const localPath = `${this.AUDIO_CACHE_DIR}${audioId}.mp3`;
      const fileInfo = await FileSystem.getInfoAsync(localPath);

      if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
        return localPath;
      }

      return null;
    } catch (error) {
      console.error(`Failed to get cached audio ${audioId}:`, error);
      return null;
    }
  }

  async removeAudioFile(audioId: string): Promise<void> {
    try {
      const localPath = `${this.AUDIO_CACHE_DIR}${audioId}.mp3`;
      await FileSystem.deleteAsync(localPath, { idempotent: true });
      await this.remove(`audio_meta:${audioId}`);
    } catch (error) {
      console.error(`Failed to remove audio ${audioId}:`, error);
    }
  }

  async clearAudioCache(): Promise<void> {
    try {
      await FileSystem.deleteAsync(this.AUDIO_CACHE_DIR, { idempotent: true });
      await this.initializeCacheDirectories();
    } catch (error) {
      console.error('Failed to clear audio cache:', error);
    }
  }

  // Image caching
  async cacheImage(url: string, imageId: string): Promise<string | null> {
    try {
      const extension = url.split('.').pop()?.split('?')[0] || 'jpg';
      const filename = `${imageId}.${extension}`;
      const localPath = this.IMAGE_CACHE_DIR + filename;

      // Check if already cached
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
        return localPath;
      }

      // Download if online
      if (await this.isOnline()) {
        const result = await FileSystem.downloadAsync(url, localPath);
        if (result.uri) {
          await this.set(`image_meta:${imageId}`, {
            url,
            localPath: result.uri,
            downloadedAt: Date.now(),
          });
          return result.uri;
        }
      }

      return null;
    } catch (error) {
      console.error(`Failed to cache image ${imageId}:`, error);
      return null;
    }
  }

  async clearImageCache(): Promise<void> {
    try {
      await FileSystem.deleteAsync(this.IMAGE_CACHE_DIR, { idempotent: true });
      await this.initializeCacheDirectories();
    } catch (error) {
      console.error('Failed to clear image cache:', error);
    }
  }

  // Cache statistics and management
  async getCacheStats(): Promise<CacheStats> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(this.CACHE_PREFIX));

      let totalSize = 0;
      let oldestItem = Date.now();
      let newestItem = 0;

      for (const key of cacheKeys) {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          totalSize += item.length;
          const parsed = JSON.parse(item) as CacheEntry;
          if (parsed.timestamp < oldestItem) oldestItem = parsed.timestamp;
          if (parsed.timestamp > newestItem) newestItem = parsed.timestamp;
        }
      }

      // Add file cache sizes
      const audioDirInfo = await FileSystem.getInfoAsync(this.AUDIO_CACHE_DIR);
      const imageDirInfo = await FileSystem.getInfoAsync(this.IMAGE_CACHE_DIR);

      if (audioDirInfo.exists && audioDirInfo.size) {
        totalSize += audioDirInfo.size;
      }
      if (imageDirInfo.exists && imageDirInfo.size) {
        totalSize += imageDirInfo.size;
      }

      return {
        totalSize,
        itemCount: cacheKeys.length,
        oldestItem,
        newestItem,
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalSize: 0,
        itemCount: 0,
        oldestItem: 0,
        newestItem: 0,
      };
    }
  }

  async enforceStorageLimit(): Promise<void> {
    const stats = await this.getCacheStats();

    if (stats.totalSize > this.MAX_CACHE_SIZE) {
      // Implement LRU eviction
      await this.evictLRU(stats.totalSize - this.MAX_CACHE_SIZE);
    }
  }

  private async evictLRU(bytesToFree: number): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(this.CACHE_PREFIX));

      // Get all cache entries with timestamps
      const entries: Array<{ key: string; timestamp: number; size: number }> = [];

      for (const key of cacheKeys) {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item) as CacheEntry;
          entries.push({
            key,
            timestamp: parsed.timestamp,
            size: item.length,
          });
        }
      }

      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);

      let freedBytes = 0;
      for (const entry of entries) {
        if (freedBytes >= bytesToFree) break;

        await AsyncStorage.removeItem(entry.key);
        freedBytes += entry.size;
      }
    } catch (error) {
      console.error('Failed to evict LRU cache:', error);
    }
  }

  // Helper methods
  private async getFromCache<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        return JSON.parse(cached) as CacheEntry<T>;
      }
      return null;
    } catch (error) {
      console.error(`Failed to get from cache ${key}:`, error);
      return null;
    }
  }

  private async setCache<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl,
        size: JSON.stringify(data).length,
      };

      await AsyncStorage.setItem(key, JSON.stringify(entry));
      await this.enforceStorageLimit();
    } catch (error) {
      console.error(`Failed to set cache ${key}:`, error);
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) return false;
    return Date.now() > entry.expiresAt;
  }

  // Download progress callback (can be set by the app)
  onDownloadProgress?: (id: string, progress: number) => void;
}

// Export singleton instance
export const cacheService = CacheService.getInstance();

// Export types
export type { CacheEntry, CacheOptions, CacheStats };