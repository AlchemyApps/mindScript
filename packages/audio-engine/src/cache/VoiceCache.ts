import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { Result, Ok, Err } from "../types";
import type { 
  TTSCacheConfig, 
  CacheEntry, 
  CacheStatistics 
} from "../types/tts.types";

interface CacheKeyData {
  text: string;
  voice: string;
  model: string;
  provider: string;
  speed?: number;
  pitch?: number;
  format?: string;
}

/**
 * File-based cache for TTS audio with LRU eviction
 */
export class VoiceCache {
  private config: TTSCacheConfig;
  private cacheHits = 0;
  private cacheMisses = 0;
  private evictionCount = 0;

  constructor(config: TTSCacheConfig) {
    this.config = config;
  }

  /**
   * Initialize cache directory
   */
  async initialize(): Promise<Result<void>> {
    if (!this.config.enabled) {
      return Ok(undefined);
    }

    try {
      // Create cache directory if it doesn't exist
      try {
        await fs.access(this.config.directory);
      } catch {
        await fs.mkdir(this.config.directory, { recursive: true });
      }

      // Clean expired entries on startup
      await this.cleanExpiredEntries();

      return Ok(undefined);
    } catch (error) {
      return Err(new Error(`Failed to initialize cache: ${(error as Error).message}`));
    }
  }

  /**
   * Generate cache key from request parameters
   */
  generateKey(data: CacheKeyData): string {
    const keyString = JSON.stringify({
      text: data.text,
      voice: data.voice,
      model: data.model,
      provider: data.provider,
      speed: data.speed || 1.0,
      pitch: data.pitch || 1.0,
      format: data.format || "mp3"
    });

    return crypto
      .createHash("sha256")
      .update(keyString)
      .digest("hex");
  }

  /**
   * Get cached audio if available
   */
  async get(key: string): Promise<Result<CacheEntry | null>> {
    if (!this.config.enabled) {
      return Ok(null);
    }

    const metadataPath = path.join(this.config.directory, `${key}.json`);
    const audioPath = path.join(this.config.directory, `${key}.audio`);

    try {
      // Read metadata
      const metadataContent = await fs.readFile(metadataPath, "utf-8");
      const entry: CacheEntry = JSON.parse(metadataContent);

      // Check if expired
      if (new Date(entry.metadata.expiresAt) < new Date()) {
        await this.deleteEntry(key);
        this.cacheMisses++;
        return Ok(null);
      }

      // Read audio data
      const audioData = await fs.readFile(audioPath);

      // Update access count and time
      entry.metadata.accessCount++;
      entry.metadata.lastAccessedAt = new Date();
      
      // Save updated metadata
      await fs.writeFile(metadataPath, JSON.stringify(entry, null, 2));

      this.cacheHits++;
      return Ok({
        ...entry,
        audioData
      });
    } catch (error) {
      // Cache miss (file doesn't exist or error reading)
      this.cacheMisses++;
      return Ok(null);
    }
  }

  /**
   * Save audio to cache
   */
  async set(
    key: string,
    audioData: Buffer,
    metadata: Omit<CacheEntry["metadata"], "createdAt" | "expiresAt" | "sizeBytes" | "accessCount" | "lastAccessedAt">
  ): Promise<Result<void>> {
    if (!this.config.enabled) {
      return Ok(undefined);
    }

    const metadataPath = path.join(this.config.directory, `${key}.json`);
    const audioPath = path.join(this.config.directory, `${key}.audio`);

    try {
      // Check cache size and evict if necessary
      await this.evictIfNecessary(audioData.length);

      const now = new Date();
      const entry: CacheEntry = {
        key,
        audioData,
        metadata: {
          ...metadata,
          createdAt: now,
          expiresAt: new Date(now.getTime() + this.config.ttlSeconds * 1000),
          sizeBytes: audioData.length,
          accessCount: 0,
          lastAccessedAt: now
        }
      };

      // Save audio file
      await fs.writeFile(audioPath, audioData);

      // Save metadata (without audio data)
      const metadataOnly = {
        key: entry.key,
        metadata: entry.metadata
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadataOnly, null, 2));

      return Ok(undefined);
    } catch (error) {
      return Err(new Error(`Failed to cache audio: ${(error as Error).message}`));
    }
  }

  /**
   * Delete cache entry
   */
  private async deleteEntry(key: string): Promise<void> {
    const metadataPath = path.join(this.config.directory, `${key}.json`);
    const audioPath = path.join(this.config.directory, `${key}.audio`);

    try {
      await fs.unlink(metadataPath);
    } catch {
      // Ignore if file doesn't exist
    }

    try {
      await fs.unlink(audioPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Clean expired entries
   */
  private async cleanExpiredEntries(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.directory, { withFileTypes: true });
      const now = new Date();

      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".json")) {
          continue;
        }

        const metadataPath = path.join(this.config.directory, file.name);
        
        try {
          const content = await fs.readFile(metadataPath, "utf-8");
          const entry = JSON.parse(content);

          if (new Date(entry.metadata.expiresAt) < now) {
            const key = file.name.replace(".json", "");
            await this.deleteEntry(key);
          }
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  /**
   * Evict old entries if cache size exceeds limit (LRU)
   */
  private async evictIfNecessary(newEntrySize: number): Promise<void> {
    const maxSizeBytes = this.config.maxSizeMB * 1024 * 1024;
    let currentSize = await this.calculateCacheSize();

    if (currentSize + newEntrySize <= maxSizeBytes) {
      return;
    }

    // Get all cache entries with metadata
    const entries: Array<{ key: string; lastAccessed: Date; size: number }> = [];
    
    try {
      const files = await fs.readdir(this.config.directory, { withFileTypes: true });

      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".json")) {
          continue;
        }

        try {
          const metadataPath = path.join(this.config.directory, file.name);
          const content = await fs.readFile(metadataPath, "utf-8");
          const entry = JSON.parse(content);

          entries.push({
            key: file.name.replace(".json", ""),
            lastAccessed: new Date(entry.metadata.lastAccessedAt),
            size: entry.metadata.sizeBytes || 0
          });
        } catch {
          // Skip invalid files
        }
      }

      // Sort by last accessed time (oldest first)
      entries.sort((a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

      // Evict until we have enough space
      for (const entry of entries) {
        if (currentSize + newEntrySize <= maxSizeBytes) {
          break;
        }

        await this.deleteEntry(entry.key);
        currentSize -= entry.size;
        this.evictionCount++;
      }
    } catch {
      // Continue even if eviction fails
    }
  }

  /**
   * Calculate total cache size
   */
  private async calculateCacheSize(): Promise<number> {
    let totalSize = 0;

    try {
      const files = await fs.readdir(this.config.directory, { withFileTypes: true });

      for (const file of files) {
        if (!file.isFile()) {
          continue;
        }

        const filePath = path.join(this.config.directory, file.name);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }
    } catch {
      // Return 0 if error
    }

    return totalSize;
  }

  /**
   * Get cache statistics
   */
  async getStatistics(): Promise<Result<CacheStatistics>> {
    try {
      const files = await fs.readdir(this.config.directory, { withFileTypes: true });
      let totalEntries = 0;
      let totalSize = 0;
      let oldestEntry: Date | undefined;
      let newestEntry: Date | undefined;

      for (const file of files) {
        if (!file.isFile()) {
          continue;
        }

        const filePath = path.join(this.config.directory, file.name);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        if (file.name.endsWith(".json")) {
          totalEntries++;
          
          try {
            const content = await fs.readFile(filePath, "utf-8");
            const entry = JSON.parse(content);
            const createdAt = new Date(entry.metadata.createdAt);

            if (!oldestEntry || createdAt < oldestEntry) {
              oldestEntry = createdAt;
            }
            if (!newestEntry || createdAt > newestEntry) {
              newestEntry = createdAt;
            }
          } catch {
            // Skip invalid files
          }
        }
      }

      const totalRequests = this.cacheHits + this.cacheMisses;
      
      return Ok({
        totalEntries,
        totalSizeBytes: totalSize,
        hitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
        missRate: totalRequests > 0 ? this.cacheMisses / totalRequests : 0,
        evictionCount: this.evictionCount,
        averageEntrySize: totalEntries > 0 ? totalSize / totalEntries : 0,
        oldestEntry,
        newestEntry
      });
    } catch (error) {
      return Err(new Error(`Failed to get statistics: ${(error as Error).message}`));
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<Result<void>> {
    try {
      const files = await fs.readdir(this.config.directory, { withFileTypes: true });

      for (const file of files) {
        if (!file.isFile()) {
          continue;
        }

        const filePath = path.join(this.config.directory, file.name);
        await fs.unlink(filePath);
      }

      // Reset statistics
      this.cacheHits = 0;
      this.cacheMisses = 0;
      this.evictionCount = 0;

      return Ok(undefined);
    } catch (error) {
      return Err(new Error(`Failed to clear cache: ${(error as Error).message}`));
    }
  }
}