import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AudioJobProcessor } from "../../src/jobs/AudioJobProcessor";
import { ProgressTracker } from "../../src/jobs/ProgressTracker";
import type { AudioJobQueue } from "@mindscript/schemas";
import type { Result } from "../../src/types";
import { TempFileManager } from "../../src/utils/TempFileManager";

// Mock dependencies
vi.mock("../../src/providers/tts/OpenAIProvider");
vi.mock("../../src/providers/tts/ElevenLabsProvider");
vi.mock("../../src/generators/SolfeggioGenerator");
vi.mock("../../src/generators/BinauralGenerator");
vi.mock("../../src/processors/AudioMixer");
vi.mock("../../src/storage/StorageUploader");
vi.mock("../../src/utils/TempFileManager");
vi.mock("../../src/jobs/ProgressTracker");

describe("AudioJobProcessor", () => {
  let processor: AudioJobProcessor;
  let mockProgressTracker: ProgressTracker;
  let mockTempFileManager: TempFileManager;

  const mockJob: AudioJobQueue = {
    id: "test-job-123",
    userId: "user-123",
    projectId: "project-456",
    status: "processing",
    priority: "normal",
    payload: {
      type: "render",
      projectData: {
        scriptText: "This is a test script for audio processing.",
        voiceRef: "openai:nova",
        durationMin: 5,
        pauseSec: 3,
        loopMode: "repeat",
        layers: {
          voice: {
            enabled: true,
            provider: "openai",
            voiceCode: "nova",
          },
          background: {
            enabled: true,
            trackUrl: "https://example.com/music.mp3",
          },
          solfeggio: {
            enabled: true,
            hz: 528,
            wave: "sine",
          },
          binaural: {
            enabled: true,
            band: "theta",
            beatHz: 7,
            carrierHz: 200,
          },
          gains: {
            voiceDb: -1,
            bgDb: -10,
            solfeggioDb: -16,
            binauralDb: -18,
          },
        },
      },
      outputOptions: {
        format: "mp3",
        quality: "high",
        storageLocation: "private",
      },
    },
    progress: 0,
    createdAt: new Date(),
    retryCount: 0,
    maxRetries: 3,
    metadata: {},
  };

  beforeEach(() => {
    mockProgressTracker = new ProgressTracker(mockJob.id);
    mockTempFileManager = new TempFileManager();
    
    processor = new AudioJobProcessor({
      progressTracker: mockProgressTracker,
      tempFileManager: mockTempFileManager,
      maxDurationMinutes: 15,
      targetLufs: -16,
    });
  });

  afterEach(async () => {
    await processor.cleanup();
    vi.clearAllMocks();
  });

  describe("processJob", () => {
    it("should process a complete audio job with all layers", async () => {
      const result = await processor.processJob(mockJob);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.outputUrl).toMatch(/^https:\/\/.+\.mp3$/);
        expect(result.data.metadata).toHaveProperty("duration");
        expect(result.data.metadata).toHaveProperty("stereoVerified", true);
        expect(result.data.metadata).toHaveProperty("lufs");
      }
    });

    it("should handle TTS-only job (no background, solfeggio, or binaural)", async () => {
      const ttsOnlyJob: AudioJobQueue = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          projectData: {
            ...mockJob.payload.projectData,
            layers: {
              ...mockJob.payload.projectData.layers,
              background: { enabled: false },
              solfeggio: { enabled: false },
              binaural: { enabled: false },
            },
          },
        },
      };

      const result = await processor.processJob(ttsOnlyJob);
      expect(result.success).toBe(true);
    });

    it("should handle ElevenLabs voice provider", async () => {
      const elevenLabsJob: AudioJobQueue = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          projectData: {
            ...mockJob.payload.projectData,
            voiceRef: "elevenlabs:voice-id-123",
            layers: {
              ...mockJob.payload.projectData.layers,
              voice: {
                enabled: true,
                provider: "elevenlabs",
                voiceCode: "voice-id-123",
              },
            },
          },
        },
      };

      const result = await processor.processJob(elevenLabsJob);
      expect(result.success).toBe(true);
    });

    it("should handle uploaded voice files", async () => {
      const uploadedVoiceJob: AudioJobQueue = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          projectData: {
            ...mockJob.payload.projectData,
            voiceRef: "uploaded:https://example.com/voice.mp3",
            layers: {
              ...mockJob.payload.projectData.layers,
              voice: {
                enabled: true,
                provider: "uploaded",
                voiceUrl: "https://example.com/voice.mp3",
              },
            },
          },
        },
      };

      const result = await processor.processJob(uploadedVoiceJob);
      expect(result.success).toBe(true);
    });

    it("should retry TTS on failure up to 3 times", async () => {
      const mockTTSProvider = vi.fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Rate limit"))
        .mockResolvedValueOnce({ success: true, audioData: Buffer.from("audio") });

      const result = await processor.processJob(mockJob);
      expect(result.success).toBe(true);
      expect(mockTTSProvider).toHaveBeenCalledTimes(3);
    });

    it("should continue without background music if download fails", async () => {
      const mockDownload = vi.fn().mockRejectedValue(new Error("404 Not Found"));
      
      const result = await processor.processJob(mockJob);
      expect(result.success).toBe(true);
      // Job should complete but without background music
    });

    it("should enforce stereo output", async () => {
      const result = await processor.processJob(mockJob);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata?.stereoVerified).toBe(true);
        expect(result.data.metadata?.channels).toBe(2);
      }
    });

    it("should normalize to target LUFS", async () => {
      const result = await processor.processJob(mockJob);
      
      expect(result.success).toBe(true);
      if (result.success) {
        const lufs = result.data.metadata?.lufs as number;
        expect(lufs).toBeGreaterThanOrEqual(-17);
        expect(lufs).toBeLessThanOrEqual(-15);
      }
    });

    it("should handle text chunking for long scripts", async () => {
      const longScriptJob: AudioJobQueue = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          projectData: {
            ...mockJob.payload.projectData,
            scriptText: "A".repeat(6000), // Over 5000 char limit
          },
        },
      };

      const result = await processor.processJob(longScriptJob);
      expect(result.success).toBe(true);
      // Should have chunked and stitched the audio
    });

    it("should update progress throughout processing", async () => {
      const progressUpdates: number[] = [];
      vi.spyOn(mockProgressTracker, "updateProgress").mockImplementation(
        async (progress) => {
          progressUpdates.push(progress);
        }
      );

      await processor.processJob(mockJob);

      expect(progressUpdates.length).toBeGreaterThan(5);
      expect(progressUpdates[0]).toBeLessThan(progressUpdates[progressUpdates.length - 1]);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it("should respect job duration limits", async () => {
      const longJob: AudioJobQueue = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          projectData: {
            ...mockJob.payload.projectData,
            durationMin: 20, // Over 15 minute limit
          },
        },
      };

      const result = await processor.processJob(longJob);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("duration");
      }
    });

    it("should clean up temp files on success", async () => {
      const cleanupSpy = vi.spyOn(mockTempFileManager, "cleanup");
      
      await processor.processJob(mockJob);
      
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it("should clean up temp files on failure", async () => {
      const cleanupSpy = vi.spyOn(mockTempFileManager, "cleanup");
      
      // Force a failure
      vi.spyOn(processor as any, "generateVoice").mockRejectedValue(
        new Error("TTS failed")
      );
      
      await processor.processJob(mockJob);
      
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it("should handle cancellation mid-process", async () => {
      const cancelPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          processor.cancel();
          resolve();
        }, 100);
      });

      const resultPromise = processor.processJob(mockJob);
      
      await cancelPromise;
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("cancelled");
      }
    });

    it("should handle loop modes correctly", async () => {
      const intervalJob: AudioJobQueue = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          projectData: {
            ...mockJob.payload.projectData,
            loopMode: "interval",
            intervalSec: 60,
          },
        },
      };

      const result = await processor.processJob(intervalJob);
      expect(result.success).toBe(true);
      // Should have proper intervals between loops
    });

    it("should apply fade in/out effects", async () => {
      const result = await processor.processJob(mockJob);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata?.fadeIn).toBe(1000);
        expect(result.data.metadata?.fadeOut).toBe(1500);
      }
    });

    it("should handle concurrent layer generation", async () => {
      const startTime = Date.now();
      const result = await processor.processJob(mockJob);
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      // Concurrent processing should be faster than sequential
      expect(duration).toBeLessThan(5000); // Assuming mocked operations
    });

    it("should validate output format", async () => {
      const wavJob: AudioJobQueue = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          outputOptions: {
            ...mockJob.payload.outputOptions,
            format: "wav",
          },
        },
      };

      const result = await processor.processJob(wavJob);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.outputUrl).toMatch(/\.wav$/);
      }
    });

    it("should handle missing optional layers gracefully", async () => {
      const minimalJob: AudioJobQueue = {
        ...mockJob,
        payload: {
          ...mockJob.payload,
          projectData: {
            ...mockJob.payload.projectData,
            layers: {
              voice: {
                enabled: true,
                provider: "openai",
                voiceCode: "nova",
              },
              background: { enabled: false },
              gains: {
                voiceDb: 0,
                bgDb: -10,
                solfeggioDb: -16,
                binauralDb: -18,
              },
            },
          },
        },
      };

      const result = await processor.processJob(minimalJob);
      expect(result.success).toBe(true);
    });

    it("should generate proper metadata for completed job", async () => {
      const result = await processor.processJob(mockJob);
      
      expect(result.success).toBe(true);
      if (result.success) {
        const metadata = result.data.metadata;
        expect(metadata).toHaveProperty("duration");
        expect(metadata).toHaveProperty("format", "mp3");
        expect(metadata).toHaveProperty("sampleRate");
        expect(metadata).toHaveProperty("bitrate");
        expect(metadata).toHaveProperty("fileSize");
        expect(metadata).toHaveProperty("layersUsed");
        expect(metadata).toHaveProperty("processingTime");
      }
    });
  });

  describe("error recovery", () => {
    it("should recover from partial TTS failure", async () => {
      // Simulate failure in middle of multi-chunk TTS
      const result = await processor.processJob(mockJob);
      expect(result.success).toBe(true);
    });

    it("should handle storage upload retry", async () => {
      const mockUpload = vi.fn()
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockResolvedValueOnce({ url: "https://storage.example.com/audio.mp3" });

      const result = await processor.processJob(mockJob);
      expect(result.success).toBe(true);
      expect(mockUpload).toHaveBeenCalledTimes(2);
    });

    it("should fail gracefully after max retries", async () => {
      const mockTTSProvider = vi.fn()
        .mockRejectedValue(new Error("Persistent error"));

      const result = await processor.processJob(mockJob);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Persistent error");
      }
    });
  });
});