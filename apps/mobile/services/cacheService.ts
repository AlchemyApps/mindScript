import { Paths, File, Directory } from 'expo-file-system';

const AUDIO_CACHE_DIR_NAME = 'audio';
const MAX_CACHE_SIZE = 200 * 1024 * 1024; // 200MB

interface CacheEntry {
  trackId: string;
  uri: string;
  size: number;
  accessedAt: number;
}

class CacheService {
  private static instance: CacheService;
  private entries: Map<string, CacheEntry> = new Map();
  private cacheDir: Directory;

  private constructor() {
    this.cacheDir = new Directory(Paths.cache, AUDIO_CACHE_DIR_NAME);
    this.ensureCacheDir();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private ensureCacheDir(): void {
    try {
      if (!this.cacheDir.exists) {
        this.cacheDir.create({ intermediates: true });
      }
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  getFile(trackId: string): File {
    return new File(this.cacheDir, `${trackId}.mp3`);
  }

  getFilePath(trackId: string): string {
    return this.getFile(trackId).uri;
  }

  isCached(trackId: string): boolean {
    try {
      const file = this.getFile(trackId);
      return file.exists && file.size > 0;
    } catch {
      return false;
    }
  }

  getCachedUri(trackId: string): string | null {
    const file = this.getFile(trackId);
    if (file.exists && file.size > 0) {
      this.entries.set(trackId, {
        trackId,
        uri: file.uri,
        size: file.size,
        accessedAt: Date.now(),
      });
      return file.uri;
    }
    return null;
  }

  addToCache(trackId: string, uri: string, size: number): void {
    this.entries.set(trackId, {
      trackId,
      uri,
      size,
      accessedAt: Date.now(),
    });
    this.enforceSizeLimit();
  }

  removeFromCache(trackId: string): void {
    try {
      const file = this.getFile(trackId);
      if (file.exists) {
        file.delete();
      }
      this.entries.delete(trackId);
    } catch (error) {
      console.error(`Failed to remove cached audio ${trackId}:`, error);
    }
  }

  clearCache(): void {
    try {
      if (this.cacheDir.exists) {
        this.cacheDir.delete();
      }
      this.entries.clear();
      this.ensureCacheDir();
    } catch (error) {
      console.error('Failed to clear audio cache:', error);
    }
  }

  getCacheSize(): number {
    try {
      if (!this.cacheDir.exists) return 0;
      const items = this.cacheDir.list();
      let total = 0;
      for (const item of items) {
        if (item instanceof File) {
          total += item.size;
        }
      }
      return total;
    } catch {
      return 0;
    }
  }

  private enforceSizeLimit(): void {
    const cacheSize = this.getCacheSize();
    if (cacheSize <= MAX_CACHE_SIZE) return;

    // Evict LRU entries
    const sorted = Array.from(this.entries.values()).sort(
      (a, b) => a.accessedAt - b.accessedAt,
    );

    let freed = 0;
    const target = cacheSize - MAX_CACHE_SIZE;

    for (const entry of sorted) {
      if (freed >= target) break;
      this.removeFromCache(entry.trackId);
      freed += entry.size;
    }
  }
}

export const cacheService = CacheService.getInstance();
