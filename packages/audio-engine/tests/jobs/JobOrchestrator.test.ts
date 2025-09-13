import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { JobOrchestrator } from "../../src/jobs/JobOrchestrator";
import { AudioJobProcessor } from "../../src/jobs/AudioJobProcessor";
import { QueueManager } from "../../src/queue/QueueManager";
import type { AudioJobQueue } from "@mindscript/schemas";

// Mock dependencies
vi.mock("../../src/jobs/AudioJobProcessor");
vi.mock("../../src/queue/QueueManager");

describe("JobOrchestrator", () => {
  let orchestrator: JobOrchestrator;
  let mockQueueManager: QueueManager;
  let mockProcessor: AudioJobProcessor;
  let mockJobs: AudioJobQueue[];

  beforeEach(() => {
    mockQueueManager = new QueueManager("https://test.supabase.co", "test-key");
    mockProcessor = new AudioJobProcessor({} as any);

    mockJobs = [
      {
        id: "job-1",
        userId: "user-1",
        status: "pending",
        priority: "high",
        payload: {
          type: "render",
          projectData: {
            scriptText: "Test script 1",
            voiceRef: "openai:nova",
            durationMin: 5,
            pauseSec: 2,
            loopMode: "repeat",
            layers: {
              voice: { enabled: true, provider: "openai", voiceCode: "nova" },
              background: { enabled: false },
              gains: { voiceDb: 0, bgDb: -10, solfeggioDb: -16, binauralDb: -18 },
            },
          },
          outputOptions: { format: "mp3", quality: "high" },
        },
        progress: 0,
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
      },
      {
        id: "job-2",
        userId: "user-2",
        status: "pending",
        priority: "normal",
        payload: {
          type: "render",
          projectData: {
            scriptText: "Test script 2",
            voiceRef: "elevenlabs:voice-123",
            durationMin: 10,
            pauseSec: 3,
            loopMode: "interval",
            intervalSec: 60,
            layers: {
              voice: { enabled: true, provider: "elevenlabs", voiceCode: "voice-123" },
              background: { enabled: true, trackUrl: "https://example.com/music.mp3" },
              gains: { voiceDb: -1, bgDb: -12, solfeggioDb: -16, binauralDb: -18 },
            },
          },
          outputOptions: { format: "wav", quality: "standard" },
        },
        progress: 0,
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
      },
    ];

    orchestrator = new JobOrchestrator({
      queueManager: mockQueueManager,
      workerId: "worker-test-123",
      maxConcurrentJobs: 2,
      pollIntervalMs: 1000,
      idleTimeoutMs: 5000,
    });
  });

  afterEach(async () => {
    await orchestrator.stop();
    vi.clearAllMocks();
  });

  describe("start/stop", () => {
    it("should start polling for jobs", async () => {
      const getNextJobSpy = vi.spyOn(mockQueueManager, "getNextJob")
        .mockResolvedValue(null);

      await orchestrator.start();
      
      // Wait for at least one poll
      await new Promise((resolve) => setTimeout(resolve, 1100));
      
      expect(getNextJobSpy).toHaveBeenCalled();
      expect(orchestrator.isRunning()).toBe(true);
    });

    it("should stop polling when stopped", async () => {
      await orchestrator.start();
      expect(orchestrator.isRunning()).toBe(true);
      
      await orchestrator.stop();
      expect(orchestrator.isRunning()).toBe(false);
    });

    it("should handle graceful shutdown", async () => {
      const processSpy = vi.spyOn(mockProcessor, "processJob")
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)));
      
      vi.spyOn(mockQueueManager, "getNextJob").mockResolvedValueOnce(mockJobs[0]);
      
      await orchestrator.start();
      
      // Wait for job to start processing
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Request shutdown while job is processing
      const stopPromise = orchestrator.stop();
      
      // Should wait for job to complete
      await stopPromise;
      
      expect(processSpy).toHaveBeenCalled();
      expect(orchestrator.isRunning()).toBe(false);
    });

    it("should handle SIGTERM signal", async () => {
      await orchestrator.start();
      
      process.emit("SIGTERM" as any);
      
      // Wait for shutdown
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      expect(orchestrator.isRunning()).toBe(false);
    });

    it("should handle SIGINT signal", async () => {
      await orchestrator.start();
      
      process.emit("SIGINT" as any);
      
      // Wait for shutdown
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      expect(orchestrator.isRunning()).toBe(false);
    });
  });

  describe("job processing", () => {
    it("should process jobs from queue", async () => {
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockResolvedValueOnce(mockJobs[0])
        .mockResolvedValue(null);
      
      const processSpy = vi.spyOn(mockProcessor, "processJob")
        .mockResolvedValue({ success: true, data: { outputUrl: "https://storage.test/audio.mp3" } });
      
      const completeSpy = vi.spyOn(mockQueueManager, "completeJob")
        .mockResolvedValue(undefined);
      
      await orchestrator.start();
      
      // Wait for job processing
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      expect(processSpy).toHaveBeenCalledWith(mockJobs[0]);
      expect(completeSpy).toHaveBeenCalledWith(mockJobs[0].id, expect.any(Object));
    });

    it("should handle concurrent jobs up to limit", async () => {
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockResolvedValueOnce(mockJobs[0])
        .mockResolvedValueOnce(mockJobs[1])
        .mockResolvedValue(null);
      
      const processSpy = vi.spyOn(mockProcessor, "processJob")
        .mockImplementation(() => new Promise((resolve) => 
          setTimeout(() => resolve({ success: true, data: { outputUrl: "test.mp3" } }), 500)
        ));
      
      await orchestrator.start();
      
      // Wait for jobs to start
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      expect(processSpy).toHaveBeenCalledTimes(2);
      expect(orchestrator.getActiveJobCount()).toBe(2);
    });

    it("should not exceed max concurrent jobs", async () => {
      // Create 3 jobs but with limit of 2
      const thirdJob = { ...mockJobs[0], id: "job-3" };
      
      let jobsReturned = 0;
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockImplementation(async () => {
          if (jobsReturned < 3) {
            return [mockJobs[0], mockJobs[1], thirdJob][jobsReturned++];
          }
          return null;
        });
      
      const processingJobs = new Set<string>();
      vi.spyOn(mockProcessor, "processJob")
        .mockImplementation(async (job) => {
          processingJobs.add(job.id);
          expect(processingJobs.size).toBeLessThanOrEqual(2);
          await new Promise((resolve) => setTimeout(resolve, 500));
          processingJobs.delete(job.id);
          return { success: true, data: { outputUrl: "test.mp3" } };
        });
      
      await orchestrator.start();
      
      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1500));
    });

    it("should handle job processing failure", async () => {
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockResolvedValueOnce(mockJobs[0])
        .mockResolvedValue(null);
      
      vi.spyOn(mockProcessor, "processJob")
        .mockResolvedValue({ success: false, error: "Processing failed" });
      
      const failSpy = vi.spyOn(mockQueueManager, "failJob")
        .mockResolvedValue(undefined);
      
      await orchestrator.start();
      
      // Wait for job processing
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      expect(failSpy).toHaveBeenCalledWith(mockJobs[0].id, "Processing failed", undefined);
    });

    it("should update job progress during processing", async () => {
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockResolvedValueOnce(mockJobs[0])
        .mockResolvedValue(null);
      
      const updateSpy = vi.spyOn(mockQueueManager, "updateProgress")
        .mockResolvedValue(undefined);
      
      vi.spyOn(mockProcessor, "processJob")
        .mockImplementation(async (job) => {
          // Simulate progress updates
          await orchestrator.updateJobProgress(job.id, 25, "Starting TTS");
          await orchestrator.updateJobProgress(job.id, 50, "Mixing audio");
          await orchestrator.updateJobProgress(job.id, 75, "Uploading");
          return { success: true, data: { outputUrl: "test.mp3" } };
        });
      
      await orchestrator.start();
      
      // Wait for job processing
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      expect(updateSpy).toHaveBeenCalledTimes(3);
    });

    it("should respect job priorities", async () => {
      const processedJobs: string[] = [];
      
      // Return high priority job first, then normal
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockResolvedValueOnce(mockJobs[0]) // high priority
        .mockResolvedValueOnce(mockJobs[1]) // normal priority
        .mockResolvedValue(null);
      
      vi.spyOn(mockProcessor, "processJob")
        .mockImplementation(async (job) => {
          processedJobs.push(job.id);
          return { success: true, data: { outputUrl: "test.mp3" } };
        });
      
      await orchestrator.start();
      
      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      expect(processedJobs[0]).toBe("job-1"); // High priority processed first
    });
  });

  describe("idle timeout", () => {
    it("should stop after idle timeout when no jobs", async () => {
      vi.spyOn(mockQueueManager, "getNextJob").mockResolvedValue(null);
      
      await orchestrator.start();
      
      // Wait for idle timeout
      await new Promise((resolve) => setTimeout(resolve, 5500));
      
      expect(orchestrator.isRunning()).toBe(false);
    });

    it("should reset idle timer when job is processed", async () => {
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockJobs[0])
        .mockResolvedValue(null);
      
      vi.spyOn(mockProcessor, "processJob")
        .mockResolvedValue({ success: true, data: { outputUrl: "test.mp3" } });
      
      await orchestrator.start();
      
      // Wait almost to idle timeout
      await new Promise((resolve) => setTimeout(resolve, 4000));
      
      // Should still be running because job was processed
      expect(orchestrator.isRunning()).toBe(true);
      
      // Wait for actual idle timeout
      await new Promise((resolve) => setTimeout(resolve, 6000));
      
      expect(orchestrator.isRunning()).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle queue connection errors", async () => {
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockRejectedValue(new Error("Database connection failed"));
      
      const errorHandler = vi.fn();
      orchestrator.on("error", errorHandler);
      
      await orchestrator.start();
      
      // Wait for error
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        message: "Database connection failed",
      }));
      
      // Should continue running and retry
      expect(orchestrator.isRunning()).toBe(true);
    });

    it("should handle processor initialization errors", async () => {
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockResolvedValue(mockJobs[0]);
      
      vi.spyOn(mockProcessor, "processJob")
        .mockRejectedValue(new Error("Failed to initialize TTS provider"));
      
      const failSpy = vi.spyOn(mockQueueManager, "failJob")
        .mockResolvedValue(undefined);
      
      await orchestrator.start();
      
      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      expect(failSpy).toHaveBeenCalled();
    });

    it("should handle job cancellation", async () => {
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockResolvedValueOnce(mockJobs[0])
        .mockResolvedValue(null);
      
      let jobCancelled = false;
      vi.spyOn(mockProcessor, "processJob")
        .mockImplementation(async () => {
          // Simulate long-running job
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, 5000);
            orchestrator.once("cancel:job-1", () => {
              clearTimeout(timeout);
              jobCancelled = true;
              reject(new Error("Job cancelled"));
            });
          });
          return { success: true, data: { outputUrl: "test.mp3" } };
        });
      
      await orchestrator.start();
      
      // Wait for job to start
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Cancel the job
      await orchestrator.cancelJob("job-1");
      
      expect(jobCancelled).toBe(true);
    });
  });

  describe("statistics", () => {
    it("should track job statistics", async () => {
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockResolvedValueOnce(mockJobs[0])
        .mockResolvedValueOnce(mockJobs[1])
        .mockResolvedValue(null);
      
      vi.spyOn(mockProcessor, "processJob")
        .mockResolvedValueOnce({ success: true, data: { outputUrl: "test1.mp3" } })
        .mockResolvedValueOnce({ success: false, error: "Failed" });
      
      vi.spyOn(mockQueueManager, "completeJob").mockResolvedValue(undefined);
      vi.spyOn(mockQueueManager, "failJob").mockResolvedValue(undefined);
      
      await orchestrator.start();
      
      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const stats = orchestrator.getStatistics();
      
      expect(stats.totalProcessed).toBe(2);
      expect(stats.successCount).toBe(1);
      expect(stats.failureCount).toBe(1);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.uptime).toBeGreaterThan(0);
    });

    it("should emit statistics events", async () => {
      const statsHandler = vi.fn();
      orchestrator.on("statistics", statsHandler);
      
      vi.spyOn(mockQueueManager, "getNextJob")
        .mockResolvedValueOnce(mockJobs[0])
        .mockResolvedValue(null);
      
      vi.spyOn(mockProcessor, "processJob")
        .mockResolvedValue({ success: true, data: { outputUrl: "test.mp3" } });
      
      vi.spyOn(mockQueueManager, "completeJob").mockResolvedValue(undefined);
      
      await orchestrator.start();
      
      // Wait for processing and stats emission
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      expect(statsHandler).toHaveBeenCalled();
    });
  });

  describe("health check", () => {
    it("should report healthy status", async () => {
      await orchestrator.start();
      
      const health = await orchestrator.getHealth();
      
      expect(health.status).toBe("healthy");
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.activeJobs).toBe(0);
      expect(health.queueConnected).toBe(true);
    });

    it("should report unhealthy on queue disconnection", async () => {
      vi.spyOn(mockQueueManager, "getJob")
        .mockRejectedValue(new Error("Connection lost"));
      
      await orchestrator.start();
      
      const health = await orchestrator.getHealth();
      
      expect(health.status).toBe("unhealthy");
      expect(health.queueConnected).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("should cleanup resources on stop", async () => {
      const cleanupSpy = vi.spyOn(mockProcessor, "cleanup");
      
      await orchestrator.start();
      await orchestrator.stop();
      
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it("should cleanup on process exit", async () => {
      const cleanupSpy = vi.spyOn(mockProcessor, "cleanup");
      
      await orchestrator.start();
      
      process.emit("exit" as any, 0);
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });
});