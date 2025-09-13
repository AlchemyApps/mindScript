import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VoiceCache } from "./VoiceCache";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

// Mock fs/promises
vi.mock("fs/promises");

describe("VoiceCache", () => {
  let cache: VoiceCache;
  const mockFs = fs as any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(Buffer.from("cached audio"));
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.stat.mockResolvedValue({ 
      size: 1024, 
      mtime: new Date(),
      isFile: () => true 
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should create cache directory if it doesn't exist", async () => {
      mockFs.access.mockRejectedValue(new Error("ENOENT"));
      
      cache = new VoiceCache({
        enabled: true,
        directory: ".cache/tts",
        ttlSeconds: 7 * 24 * 60 * 60,
        maxSizeMB: 1024
      });

      await cache.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        ".cache/tts",
        { recursive: true }
      );
    });

    it("should not create directory if it exists", async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      cache = new VoiceCache({
        enabled: true,
        directory: ".cache/tts",
        ttlSeconds: 7 * 24 * 60 * 60,
        maxSizeMB: 1024
      });

      await cache.initialize();

      expect(mockFs.mkdir).not.toHaveBeenCalled();
    });

    it("should clean expired entries on initialization", async () => {
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days old
      
      mockFs.readdir.mockResolvedValue([
        { name: "old-cache.json", isFile: () => true },
        { name: "old-cache.audio", isFile: () => true },
        { name: "recent-cache.json", isFile: () => true },
        { name: "recent-cache.audio", isFile: () => true }
      ]);

      mockFs.stat.mockImplementation((filePath: string) => {
        if (filePath.includes("old-cache")) {
          return Promise.resolve({ 
            size: 1024, 
            mtime: oldDate,
            isFile: () => true 
          });
        }
        return Promise.resolve({ 
          size: 1024, 
          mtime: new Date(),
          isFile: () => true 
        });
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith(".json")) {
          return Promise.resolve(JSON.stringify({
            key: "test-key",
            metadata: {
              createdAt: filePath.includes("old") ? oldDate : new Date(),
              expiresAt: filePath.includes("old") 
                ? new Date(oldDate.getTime() + 7 * 24 * 60 * 60 * 1000)
                : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
          }));
        }
        return Promise.resolve(Buffer.from("audio"));
      });

      cache = new VoiceCache({
        enabled: true,
        directory: ".cache/tts",
        ttlSeconds: 7 * 24 * 60 * 60,
        maxSizeMB: 1024
      });

      await cache.initialize();

      // Should delete old cache files
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining("old-cache.json")
      );
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining("old-cache.audio")
      );
    });
  });

  describe("get", () => {
    beforeEach(async () => {
      cache = new VoiceCache({
        enabled: true,
        directory: ".cache/tts",
        ttlSeconds: 7 * 24 * 60 * 60,
        maxSizeMB: 1024
      });
      await cache.initialize();
    });

    it("should return cached audio if exists and not expired", async () => {
      const key = cache.generateKey({
        text: "Hello",
        voice: "alloy",
        model: "tts-1",
        provider: "openai",
        speed: 1.0
      });

      const metadata = {
        text: "Hello",
        voice: "alloy",
        model: "tts-1",
        provider: "openai",
        format: "mp3",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        sizeBytes: 1024,
        accessCount: 1,
        lastAccessedAt: new Date()
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith(".json")) {
          return Promise.resolve(JSON.stringify({ key, metadata }));
        }
        return Promise.resolve(Buffer.from("cached audio"));
      });

      const result = await cache.get(key);
      
      expect(result.isOk).toBe(true);
      if (result.isOk && result.value) {
        expect(result.value.audioData).toBeInstanceOf(Buffer);
        expect(result.value.metadata.text).toBe("Hello");
      }
    });

    it("should return null if cache doesn't exist", async () => {
      mockFs.readFile.mockRejectedValue(new Error("ENOENT"));

      const result = await cache.get("non-existent-key");
      
      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBeNull();
      }
    });

    it("should return null if cache is expired", async () => {
      const key = "expired-key";
      const expiredDate = new Date(Date.now() - 1000); // Expired 1 second ago

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith(".json")) {
          return Promise.resolve(JSON.stringify({
            key,
            metadata: {
              expiresAt: expiredDate,
              createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
            }
          }));
        }
        return Promise.resolve(Buffer.from("cached audio"));
      });

      const result = await cache.get(key);
      
      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBeNull();
      }

      // Should delete expired cache
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it("should update access count and last accessed time", async () => {
      const key = "test-key";
      const metadata = {
        text: "Hello",
        voice: "alloy",
        model: "tts-1",
        provider: "openai",
        format: "mp3",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        sizeBytes: 1024,
        accessCount: 5,
        lastAccessedAt: new Date(Date.now() - 60000)
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith(".json")) {
          return Promise.resolve(JSON.stringify({ key, metadata }));
        }
        return Promise.resolve(Buffer.from("cached audio"));
      });

      await cache.get(key);

      // Should update metadata
      expect(mockFs.writeFile).toHaveBeenCalled();
      const writeCall = mockFs.writeFile.mock.calls[0];
      expect(writeCall[0]).toContain(".json");
      const writtenData = JSON.parse(writeCall[1]);
      expect(writtenData.metadata.accessCount).toBe(6);
    });

    it("should return null when cache is disabled", async () => {
      cache = new VoiceCache({
        enabled: false,
        directory: ".cache/tts",
        ttlSeconds: 7 * 24 * 60 * 60,
        maxSizeMB: 1024
      });

      const result = await cache.get("any-key");
      
      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("set", () => {
    beforeEach(async () => {
      cache = new VoiceCache({
        enabled: true,
        directory: ".cache/tts",
        ttlSeconds: 7 * 24 * 60 * 60,
        maxSizeMB: 1024
      });
      await cache.initialize();
    });

    it("should save audio and metadata to cache", async () => {
      const audioData = Buffer.from("test audio data");
      const cacheData = {
        text: "Hello world",
        voice: "alloy",
        model: "tts-1",
        provider: "openai",
        format: "mp3"
      };

      const key = cache.generateKey(cacheData);
      const result = await cache.set(key, audioData, cacheData);

      expect(result.isOk).toBe(true);
      
      // Should write audio file
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(".audio"),
        audioData
      );

      // Should write metadata file
      const metadataCall = mockFs.writeFile.mock.calls.find((call: any) => 
        call[0].endsWith(".json")
      );
      expect(metadataCall).toBeDefined();
      expect(metadataCall[0]).toContain(".json");
      const metadata = JSON.parse(metadataCall[1]);
      expect(metadata.metadata.text).toBe("Hello world");
    });

    it("should enforce max cache size with LRU eviction", async () => {
      // Set small cache size
      cache = new VoiceCache({
        enabled: true,
        directory: ".cache/tts",
        ttlSeconds: 7 * 24 * 60 * 60,
        maxSizeMB: 0.001 // 1KB max
      });
      await cache.initialize();

      // Mock existing cache files
      mockFs.readdir.mockResolvedValue([
        { name: "old1.json", isFile: () => true },
        { name: "old1.audio", isFile: () => true },
        { name: "old2.json", isFile: () => true },
        { name: "old2.audio", isFile: () => true }
      ]);

      mockFs.stat.mockResolvedValue({ 
        size: 600, // Each file is 600 bytes
        mtime: new Date(Date.now() - 60000),
        isFile: () => true 
      });

      const oldMetadata = {
        lastAccessedAt: new Date(Date.now() - 60000),
        sizeBytes: 600
      };

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith(".json")) {
          return Promise.resolve(JSON.stringify({ 
            key: "old-key",
            metadata: oldMetadata 
          }));
        }
        return Promise.resolve(Buffer.from("old audio"));
      });

      // Try to add new cache that would exceed limit
      const audioData = Buffer.from("new audio data");
      const result = await cache.set("new-key", audioData, {
        text: "New",
        voice: "alloy",
        model: "tts-1",
        provider: "openai",
        format: "mp3"
      });

      expect(result.isOk).toBe(true);
      
      // Should evict old files
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it("should not cache when disabled", async () => {
      cache = new VoiceCache({
        enabled: false,
        directory: ".cache/tts",
        ttlSeconds: 7 * 24 * 60 * 60,
        maxSizeMB: 1024
      });

      const result = await cache.set("key", Buffer.from("audio"), {
        text: "Test",
        voice: "alloy",
        model: "tts-1",
        provider: "openai",
        format: "mp3"
      });

      expect(result.isOk).toBe(true);
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("generateKey", () => {
    beforeEach(() => {
      cache = new VoiceCache({
        enabled: true,
        directory: ".cache/tts",
        ttlSeconds: 7 * 24 * 60 * 60,
        maxSizeMB: 1024
      });
    });

    it("should generate consistent hash for same inputs", () => {
      const data = {
        text: "Hello world",
        voice: "alloy",
        model: "tts-1",
        provider: "openai",
        speed: 1.0
      };

      const key1 = cache.generateKey(data);
      const key2 = cache.generateKey(data);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hash
    });

    it("should generate different hashes for different inputs", () => {
      const key1 = cache.generateKey({
        text: "Hello",
        voice: "alloy",
        model: "tts-1",
        provider: "openai",
        speed: 1.0
      });

      const key2 = cache.generateKey({
        text: "Hello",
        voice: "nova", // Different voice
        model: "tts-1",
        provider: "openai",
        speed: 1.0
      });

      expect(key1).not.toBe(key2);
    });

    it("should include all parameters in hash", () => {
      const baseData = {
        text: "Test",
        voice: "alloy",
        model: "tts-1",
        provider: "openai"
      };

      const key1 = cache.generateKey({ ...baseData, speed: 1.0 });
      const key2 = cache.generateKey({ ...baseData, speed: 1.5 });
      const key3 = cache.generateKey({ ...baseData, pitch: 1.2 });

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });
  });

  describe("getStatistics", () => {
    beforeEach(async () => {
      cache = new VoiceCache({
        enabled: true,
        directory: ".cache/tts",
        ttlSeconds: 7 * 24 * 60 * 60,
        maxSizeMB: 1024
      });
      await cache.initialize();
    });

    it("should return cache statistics", async () => {
      mockFs.readdir.mockResolvedValue([
        { name: "cache1.json", isFile: () => true },
        { name: "cache1.audio", isFile: () => true },
        { name: "cache2.json", isFile: () => true },
        { name: "cache2.audio", isFile: () => true }
      ]);

      mockFs.stat.mockResolvedValue({ 
        size: 1024,
        mtime: new Date(),
        isFile: () => true 
      });

      const stats = await cache.getStatistics();

      expect(stats.isOk).toBe(true);
      if (stats.isOk) {
        expect(stats.value.totalEntries).toBe(2);
        expect(stats.value.totalSizeBytes).toBe(4096); // 4 files * 1024 bytes
        expect(stats.value.averageEntrySize).toBe(2048); // 4096 / 2
      }
    });

    it("should calculate hit/miss rates", async () => {
      // Simulate some cache hits and misses
      cache["cacheHits"] = 10;
      cache["cacheMisses"] = 5;

      const stats = await cache.getStatistics();

      expect(stats.isOk).toBe(true);
      if (stats.isOk) {
        expect(stats.value.hitRate).toBeCloseTo(0.667, 2); // 10 / 15
        expect(stats.value.missRate).toBeCloseTo(0.333, 2); // 5 / 15
      }
    });
  });

  describe("clear", () => {
    beforeEach(async () => {
      cache = new VoiceCache({
        enabled: true,
        directory: ".cache/tts",
        ttlSeconds: 7 * 24 * 60 * 60,
        maxSizeMB: 1024
      });
      await cache.initialize();
    });

    it("should remove all cache files", async () => {
      mockFs.readdir.mockResolvedValue([
        { name: "cache1.json", isFile: () => true },
        { name: "cache1.audio", isFile: () => true },
        { name: "cache2.json", isFile: () => true },
        { name: "cache2.audio", isFile: () => true }
      ]);

      const result = await cache.clear();

      expect(result.isOk).toBe(true);
      expect(mockFs.unlink).toHaveBeenCalledTimes(4);
    });

    it("should reset statistics after clear", async () => {
      cache["cacheHits"] = 10;
      cache["cacheMisses"] = 5;
      cache["evictionCount"] = 3;

      await cache.clear();

      const stats = await cache.getStatistics();
      
      expect(stats.isOk).toBe(true);
      if (stats.isOk) {
        expect(stats.value.hitRate).toBe(0);
        expect(stats.value.missRate).toBe(0);
        expect(stats.value.evictionCount).toBe(0);
      }
    });
  });
});