import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OpenAIProvider } from "./OpenAIProvider";
import { ElevenLabsProvider } from "./ElevenLabsProvider";
import { VoiceCache } from "../cache/VoiceCache";
import type { TTSProvider, TTSSynthesisRequest } from "../types/tts.types";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Integration tests for TTS providers
 * These tests are skipped by default unless INTEGRATION_TEST env var is set
 * They require actual API keys to run
 */
describe.skipIf(!process.env.INTEGRATION_TEST)("TTS Provider Integration", () => {
  let openaiProvider: TTSProvider;
  let elevenLabsProvider: TTSProvider;
  let cache: VoiceCache;
  const testCacheDir = ".cache/test-tts";

  beforeEach(async () => {
    // Initialize providers with real API keys
    openaiProvider = new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY!
    });

    elevenLabsProvider = new ElevenLabsProvider({
      apiKey: process.env.ELEVENLABS_API_KEY!
    });

    // Initialize cache
    cache = new VoiceCache({
      enabled: true,
      directory: testCacheDir,
      ttlSeconds: 3600,
      maxSizeMB: 10
    });

    await cache.initialize();
  });

  afterEach(async () => {
    // Clean up test cache
    await cache.clear();
    try {
      await fs.rmdir(testCacheDir);
    } catch {
      // Ignore if directory doesn't exist
    }
  });

  describe("OpenAI Provider Integration", () => {
    it("should synthesize text with OpenAI", async () => {
      const request: TTSSynthesisRequest = {
        text: "Hello from OpenAI TTS integration test.",
        voice: "alloy",
        model: "tts-1",
        speed: 1.0,
        format: "mp3"
      };

      const result = await openaiProvider.synthesize(request);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.audioData).toBeInstanceOf(Buffer);
        expect(result.value.audioData.length).toBeGreaterThan(0);
        expect(result.value.format).toBe("mp3");
        expect(result.value.voiceUsed).toBe("alloy");
        expect(result.value.modelUsed).toBe("tts-1");
        
        // Verify it's valid MP3 data (starts with ID3 or FF FB)
        const header = result.value.audioData.slice(0, 3).toString();
        const isMP3 = header === "ID3" || 
                     (result.value.audioData[0] === 0xFF && 
                      (result.value.audioData[1] & 0xE0) === 0xE0);
        expect(isMP3).toBe(true);
      }
    }, 30000); // 30 second timeout for API call

    it("should get available voices from OpenAI", async () => {
      const result = await openaiProvider.getAvailableVoices();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toHaveLength(6);
        const voiceIds = result.value.map(v => v.id);
        expect(voiceIds).toContain("alloy");
        expect(voiceIds).toContain("nova");
        expect(voiceIds).toContain("shimmer");
      }
    });

    it("should handle different speeds", async () => {
      const speeds = [0.5, 1.0, 2.0];
      
      for (const speed of speeds) {
        const result = await openaiProvider.synthesize({
          text: "Testing speed adjustment.",
          voice: "alloy",
          speed
        });

        expect(result.isOk).toBe(true);
        if (result.isOk) {
          expect(result.value.audioData.length).toBeGreaterThan(0);
        }
      }
    }, 60000); // Longer timeout for multiple API calls
  });

  describe("ElevenLabs Provider Integration", () => {
    it("should synthesize text with ElevenLabs", async () => {
      const request: TTSSynthesisRequest = {
        text: "Hello from ElevenLabs TTS integration test.",
        voice: "21m00Tcm4TlvDq8ikWAM", // Rachel voice
        model: "eleven_monolingual_v1"
      };

      const result = await elevenLabsProvider.synthesize(request);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.audioData).toBeInstanceOf(Buffer);
        expect(result.value.audioData.length).toBeGreaterThan(0);
        expect(result.value.voiceUsed).toBe("21m00Tcm4TlvDq8ikWAM");
        expect(result.value.modelUsed).toBe("eleven_monolingual_v1");
      }
    }, 30000);

    it("should get available voices from ElevenLabs", async () => {
      const result = await elevenLabsProvider.getAvailableVoices();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.length).toBeGreaterThan(0);
        
        // Check that voices have expected properties
        const firstVoice = result.value[0];
        expect(firstVoice).toHaveProperty("id");
        expect(firstVoice).toHaveProperty("name");
        expect(firstVoice.provider).toBe("elevenlabs");
      }
    }, 30000);
  });

  describe("Cache Integration", () => {
    it("should cache and retrieve synthesized audio", async () => {
      const request: TTSSynthesisRequest = {
        text: "This audio should be cached.",
        voice: "alloy",
        model: "tts-1"
      };

      // First synthesis - should hit API
      const result1 = await openaiProvider.synthesize(request);
      expect(result1.isOk).toBe(true);

      if (result1.isOk) {
        // Cache the result
        const cacheKey = cache.generateKey({
          text: request.text,
          voice: request.voice,
          model: request.model!,
          provider: "openai",
          speed: 1.0
        });

        await cache.set(cacheKey, result1.value.audioData, {
          text: request.text,
          voice: request.voice,
          model: request.model!,
          provider: "openai",
          format: result1.value.format
        });

        // Retrieve from cache
        const cachedResult = await cache.get(cacheKey);
        expect(cachedResult.isOk).toBe(true);
        
        if (cachedResult.isOk && cachedResult.value) {
          expect(cachedResult.value.audioData).toEqual(result1.value.audioData);
          expect(cachedResult.value.metadata.text).toBe(request.text);
          expect(cachedResult.value.metadata.voice).toBe(request.voice);
        }
      }
    }, 30000);

    it("should handle cache statistics correctly", async () => {
      // Add some items to cache
      const requests = [
        { text: "First item", voice: "alloy" },
        { text: "Second item", voice: "nova" },
        { text: "Third item", voice: "shimmer" }
      ];

      for (const req of requests) {
        const result = await openaiProvider.synthesize({
          ...req,
          model: "tts-1"
        });

        if (result.isOk) {
          const key = cache.generateKey({
            text: req.text,
            voice: req.voice,
            model: "tts-1",
            provider: "openai",
            speed: 1.0
          });

          await cache.set(key, result.value.audioData, {
            text: req.text,
            voice: req.voice,
            model: "tts-1",
            provider: "openai",
            format: "mp3"
          });
        }
      }

      const stats = await cache.getStatistics();
      expect(stats.isOk).toBe(true);
      
      if (stats.isOk) {
        expect(stats.value.totalEntries).toBe(3);
        expect(stats.value.totalSizeBytes).toBeGreaterThan(0);
        expect(stats.value.averageEntrySize).toBeGreaterThan(0);
      }
    }, 60000);
  });

  describe("Error Handling Integration", () => {
    it("should handle invalid API keys gracefully", async () => {
      const invalidProvider = new OpenAIProvider({
        apiKey: "invalid-key"
      });

      const result = await invalidProvider.synthesize({
        text: "This should fail",
        voice: "alloy"
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it("should handle network timeouts", async () => {
      const timeoutProvider = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY!,
        timeout: 1 // 1ms timeout
      });

      const result = await timeoutProvider.synthesize({
        text: "This should timeout",
        voice: "alloy"
      });

      expect(result.isOk).toBe(false);
    });
  });

  describe("Provider Comparison", () => {
    it("should synthesize the same text with both providers", async () => {
      const text = "Testing both TTS providers with the same text.";

      const [openaiResult, elevenLabsResult] = await Promise.all([
        openaiProvider.synthesize({
          text,
          voice: "alloy",
          model: "tts-1"
        }),
        elevenLabsProvider.synthesize({
          text,
          voice: "21m00Tcm4TlvDq8ikWAM",
          model: "eleven_monolingual_v1"
        })
      ]);

      expect(openaiResult.isOk).toBe(true);
      expect(elevenLabsResult.isOk).toBe(true);

      if (openaiResult.isOk && elevenLabsResult.isOk) {
        // Both should produce audio
        expect(openaiResult.value.audioData.length).toBeGreaterThan(0);
        expect(elevenLabsResult.value.audioData.length).toBeGreaterThan(0);
        
        // Character count should be the same
        expect(openaiResult.value.charactersUsed).toBe(elevenLabsResult.value.charactersUsed);
      }
    }, 60000);
  });
});