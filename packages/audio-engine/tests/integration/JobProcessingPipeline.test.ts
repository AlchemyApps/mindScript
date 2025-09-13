import { describe, it, expect, beforeEach, vi } from "vitest";
import { AudioJobProcessor } from "../../src/jobs/AudioJobProcessor";
import { ProgressTracker } from "../../src/jobs/ProgressTracker";
import { TempFileManager } from "../../src/utils/TempFileManager";
import type { AudioJobQueue } from "@mindscript/schemas";

describe("Job Processing Pipeline Integration", () => {
  let processor: AudioJobProcessor;

  const createTestJob = (overrides?: Partial<AudioJobQueue>): AudioJobQueue => ({
    id: "test-job-123",
    userId: "user-123",
    status: "processing",
    priority: "normal",
    payload: {
      type: "render",
      projectData: {
        scriptText: "This is a test audio script.",
        voiceRef: "openai:nova",
        durationMin: 5,
        pauseSec: 2,
        loopMode: "repeat",
        layers: {
          voice: {
            enabled: true,
            provider: "openai",
            voiceCode: "nova",
          },
          background: {
            enabled: false,
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
    ...overrides,
  });

  beforeEach(() => {
    // Mock environment variables
    process.env.OPENAI_API_KEY = "test-key";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "test-service-key";
  });

  describe("Progress Tracking", () => {
    it("should track progress through all stages", async () => {
      const progressUpdates: number[] = [];
      const progressTracker = new ProgressTracker("test-job", {
        updateCallback: async (update) => {
          progressUpdates.push(update.progress);
        },
      });

      processor = new AudioJobProcessor({
        progressTracker,
        tempFileManager: new TempFileManager(),
      });

      // Mock the actual processing methods
      vi.spyOn(processor as any, "validateJob").mockReturnValue({ isOk: true });
      vi.spyOn(processor as any, "generateVoice").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/voice.mp3" 
      });
      vi.spyOn(processor as any, "mixAudioLayers").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/mixed.wav" 
      });
      vi.spyOn(processor as any, "normalizeAudio").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/normalized.wav" 
      });
      vi.spyOn(processor as any, "convertToFormat").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/output.mp3" 
      });
      vi.spyOn(processor as any, "uploadToStorage").mockResolvedValue({ 
        isOk: true, 
        value: "https://storage.test/output.mp3" 
      });

      const job = createTestJob();
      const result = await processor.processJob(job);

      expect(result.success).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
      
      // Verify stages were completed in order
      const stages = progressTracker.getSummary().completedStages;
      expect(stages).toContain("INITIALIZING");
      expect(stages).toContain("GENERATING_VOICE");
      expect(stages).toContain("UPLOADING");
    });
  });

  describe("Error Recovery", () => {
    it("should handle TTS failure gracefully", async () => {
      processor = new AudioJobProcessor({
        tempFileManager: new TempFileManager(),
      });

      vi.spyOn(processor as any, "generateVoice").mockResolvedValue({ 
        isOk: false, 
        error: "TTS provider unavailable" 
      });

      const job = createTestJob();
      const result = await processor.processJob(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Voice generation failed");
    });

    it("should continue without background music on download failure", async () => {
      processor = new AudioJobProcessor({
        tempFileManager: new TempFileManager(),
      });

      vi.spyOn(processor as any, "downloadBackgroundMusic").mockResolvedValue({ 
        isOk: false, 
        error: "404 Not Found" 
      });

      const job = createTestJob({
        payload: {
          ...createTestJob().payload,
          projectData: {
            ...createTestJob().payload.projectData,
            layers: {
              ...createTestJob().payload.projectData.layers,
              background: {
                enabled: true,
                trackUrl: "https://example.com/missing.mp3",
              },
            },
          },
        },
      });

      // Mock other methods to succeed
      vi.spyOn(processor as any, "generateVoice").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/voice.mp3" 
      });
      vi.spyOn(processor as any, "mixAudioLayers").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/mixed.wav" 
      });
      vi.spyOn(processor as any, "normalizeAudio").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/normalized.wav" 
      });
      vi.spyOn(processor as any, "convertToFormat").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/output.mp3" 
      });
      vi.spyOn(processor as any, "uploadToStorage").mockResolvedValue({ 
        isOk: true, 
        value: "https://storage.test/output.mp3" 
      });

      const result = await processor.processJob(job);
      
      // Should succeed without background music
      expect(result.success).toBe(true);
    });
  });

  describe("Cleanup", () => {
    it("should clean up temp files on success", async () => {
      const tempFileManager = new TempFileManager();
      const cleanupSpy = vi.spyOn(tempFileManager, "cleanup");

      processor = new AudioJobProcessor({
        tempFileManager,
      });

      // Mock successful processing
      vi.spyOn(processor as any, "validateJob").mockReturnValue({ isOk: true });
      vi.spyOn(processor as any, "generateVoice").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/voice.mp3" 
      });
      vi.spyOn(processor as any, "mixAudioLayers").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/mixed.wav" 
      });
      vi.spyOn(processor as any, "normalizeAudio").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/normalized.wav" 
      });
      vi.spyOn(processor as any, "convertToFormat").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/output.mp3" 
      });
      vi.spyOn(processor as any, "uploadToStorage").mockResolvedValue({ 
        isOk: true, 
        value: "https://storage.test/output.mp3" 
      });

      const job = createTestJob();
      await processor.processJob(job);

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it("should clean up temp files on failure", async () => {
      const tempFileManager = new TempFileManager();
      const cleanupSpy = vi.spyOn(tempFileManager, "cleanup");

      processor = new AudioJobProcessor({
        tempFileManager,
      });

      // Mock failure
      vi.spyOn(processor as any, "generateVoice").mockResolvedValue({ 
        isOk: false, 
        error: "TTS failed" 
      });

      const job = createTestJob();
      await processor.processJob(job);

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe("Metadata Generation", () => {
    it("should generate comprehensive metadata", async () => {
      processor = new AudioJobProcessor({
        tempFileManager: new TempFileManager(),
      });

      // Mock all processing steps
      vi.spyOn(processor as any, "validateJob").mockReturnValue({ isOk: true });
      vi.spyOn(processor as any, "generateVoice").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/voice.mp3" 
      });
      vi.spyOn(processor as any, "mixAudioLayers").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/mixed.wav" 
      });
      vi.spyOn(processor as any, "normalizeAudio").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/normalized.wav" 
      });
      vi.spyOn(processor as any, "convertToFormat").mockResolvedValue({ 
        isOk: true, 
        value: "/tmp/output.mp3" 
      });
      vi.spyOn(processor as any, "uploadToStorage").mockResolvedValue({ 
        isOk: true, 
        value: "https://storage.test/output.mp3" 
      });
      vi.spyOn(processor as any, "generateMetadata").mockResolvedValue({
        jobId: "test-job-123",
        duration: 300,
        format: "mp3",
        sampleRate: 44100,
        bitrate: "192k",
        channels: 2,
        stereoVerified: true,
        lufs: -16,
        fileSize: 2400000,
        layersUsed: ["voice"],
        processingTime: 5000,
        fadeIn: 1000,
        fadeOut: 1500,
        completedAt: new Date().toISOString(),
      });

      const job = createTestJob();
      const result = await processor.processJob(job);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toBeDefined();
        expect(result.data.metadata?.stereoVerified).toBe(true);
        expect(result.data.metadata?.channels).toBe(2);
        expect(result.data.metadata?.lufs).toBe(-16);
      }
    });
  });
});