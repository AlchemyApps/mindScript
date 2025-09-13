import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProgressTracker } from "../../src/jobs/ProgressTracker";
import { EventEmitter } from "events";

describe("ProgressTracker", () => {
  let tracker: ProgressTracker;
  const jobId = "test-job-123";
  let mockUpdateCallback: ReturnType<typeof vi.fn>;
  let mockEventEmitter: EventEmitter;

  beforeEach(() => {
    mockUpdateCallback = vi.fn();
    mockEventEmitter = new EventEmitter();
    
    tracker = new ProgressTracker(jobId, {
      updateCallback: mockUpdateCallback,
      eventEmitter: mockEventEmitter,
    });
  });

  describe("stage weights", () => {
    it("should have correct weight distribution totaling 100%", () => {
      const stages = tracker.getStages();
      const totalWeight = Object.values(stages).reduce(
        (sum, stage) => sum + stage.weight,
        0
      );
      expect(totalWeight).toBe(100);
    });

    it("should define all required stages", () => {
      const stages = tracker.getStages();
      expect(stages).toHaveProperty("INITIALIZING");
      expect(stages).toHaveProperty("DOWNLOADING_ASSETS");
      expect(stages).toHaveProperty("GENERATING_VOICE");
      expect(stages).toHaveProperty("GENERATING_TONES");
      expect(stages).toHaveProperty("MIXING_AUDIO");
      expect(stages).toHaveProperty("NORMALIZING");
      expect(stages).toHaveProperty("UPLOADING");
    });

    it("should have appropriate weights for each stage", () => {
      const stages = tracker.getStages();
      expect(stages.INITIALIZING.weight).toBe(5);
      expect(stages.DOWNLOADING_ASSETS.weight).toBe(10);
      expect(stages.GENERATING_VOICE.weight).toBe(30);
      expect(stages.GENERATING_TONES.weight).toBe(10);
      expect(stages.MIXING_AUDIO.weight).toBe(25);
      expect(stages.NORMALIZING.weight).toBe(10);
      expect(stages.UPLOADING.weight).toBe(10);
    });
  });

  describe("startStage", () => {
    it("should set current stage and update progress", async () => {
      await tracker.startStage("INITIALIZING");
      
      expect(tracker.getCurrentStage()).toBe("INITIALIZING");
      expect(tracker.getProgress()).toBe(0);
      expect(mockUpdateCallback).toHaveBeenCalledWith({
        jobId,
        progress: 0,
        message: "Initializing job",
      });
    });

    it("should calculate cumulative progress for later stages", async () => {
      await tracker.startStage("GENERATING_VOICE");
      
      // Should include INITIALIZING (5%) + DOWNLOADING_ASSETS (10%) = 15%
      expect(tracker.getProgress()).toBe(15);
    });

    it("should emit progress events", async () => {
      const progressHandler = vi.fn();
      mockEventEmitter.on("progress", progressHandler);
      
      await tracker.startStage("MIXING_AUDIO");
      
      expect(progressHandler).toHaveBeenCalledWith({
        jobId,
        stage: "MIXING_AUDIO",
        progress: expect.any(Number),
        message: "Mixing audio layers",
      });
    });

    it("should handle invalid stage names gracefully", async () => {
      await expect(tracker.startStage("INVALID_STAGE" as any)).rejects.toThrow();
    });
  });

  describe("updateStageProgress", () => {
    it("should update progress within current stage", async () => {
      await tracker.startStage("GENERATING_VOICE");
      await tracker.updateStageProgress(0.5); // 50% of voice generation
      
      // 15% (previous stages) + 30% * 0.5 = 30%
      expect(tracker.getProgress()).toBe(30);
    });

    it("should clamp progress between 0 and 1", async () => {
      await tracker.startStage("MIXING_AUDIO");
      
      await tracker.updateStageProgress(-0.5);
      expect(tracker.getStageProgress()).toBe(0);
      
      await tracker.updateStageProgress(1.5);
      expect(tracker.getStageProgress()).toBe(1);
    });

    it("should call update callback with calculated progress", async () => {
      await tracker.startStage("NORMALIZING");
      await tracker.updateStageProgress(0.75);
      
      expect(mockUpdateCallback).toHaveBeenLastCalledWith({
        jobId,
        progress: expect.any(Number),
        message: expect.stringContaining("Normalizing"),
      });
    });

    it("should handle rapid updates efficiently", async () => {
      await tracker.startStage("GENERATING_VOICE");
      
      // Simulate rapid progress updates
      for (let i = 0; i <= 100; i++) {
        await tracker.updateStageProgress(i / 100);
      }
      
      // Should throttle updates
      expect(mockUpdateCallback.mock.calls.length).toBeLessThan(50);
    });
  });

  describe("completeStage", () => {
    it("should mark stage as complete with 100% progress", async () => {
      await tracker.startStage("DOWNLOADING_ASSETS");
      await tracker.completeStage();
      
      expect(tracker.getStageProgress()).toBe(1);
      expect(tracker.isStageComplete("DOWNLOADING_ASSETS")).toBe(true);
    });

    it("should auto-advance to next stage if configured", async () => {
      const autoTracker = new ProgressTracker(jobId, {
        updateCallback: mockUpdateCallback,
        autoAdvance: true,
      });
      
      await autoTracker.startStage("INITIALIZING");
      await autoTracker.completeStage();
      
      expect(autoTracker.getCurrentStage()).toBe("DOWNLOADING_ASSETS");
    });

    it("should emit stage completion event", async () => {
      const completeHandler = vi.fn();
      mockEventEmitter.on("stageComplete", completeHandler);
      
      await tracker.startStage("UPLOADING");
      await tracker.completeStage();
      
      expect(completeHandler).toHaveBeenCalledWith({
        jobId,
        stage: "UPLOADING",
        duration: expect.any(Number),
      });
    });
  });

  describe("setCustomMessage", () => {
    it("should allow custom progress messages", async () => {
      await tracker.startStage("GENERATING_VOICE");
      await tracker.setCustomMessage("Processing chunk 3 of 5");
      
      expect(mockUpdateCallback).toHaveBeenLastCalledWith({
        jobId,
        progress: expect.any(Number),
        message: "Processing chunk 3 of 5",
      });
    });

    it("should revert to stage message when cleared", async () => {
      await tracker.startStage("MIXING_AUDIO");
      await tracker.setCustomMessage("Custom message");
      await tracker.setCustomMessage(null);
      
      expect(mockUpdateCallback).toHaveBeenLastCalledWith({
        jobId,
        progress: expect.any(Number),
        message: "Mixing audio layers",
      });
    });
  });

  describe("getElapsedTime", () => {
    it("should track elapsed time for stages", async () => {
      await tracker.startStage("GENERATING_VOICE");
      
      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      const elapsed = tracker.getElapsedTime("GENERATING_VOICE");
      expect(elapsed).toBeGreaterThan(90);
      expect(elapsed).toBeLessThan(150);
    });

    it("should return 0 for unstarted stages", () => {
      expect(tracker.getElapsedTime("UPLOADING")).toBe(0);
    });
  });

  describe("getTotalProgress", () => {
    it("should calculate overall progress across all stages", async () => {
      await tracker.startStage("INITIALIZING");
      await tracker.completeStage();
      
      await tracker.startStage("DOWNLOADING_ASSETS");
      await tracker.completeStage();
      
      await tracker.startStage("GENERATING_VOICE");
      await tracker.updateStageProgress(0.5);
      
      // 5% + 10% + (30% * 0.5) = 30%
      expect(tracker.getTotalProgress()).toBe(30);
    });

    it("should return 100 when all stages complete", async () => {
      const stages = [
        "INITIALIZING",
        "DOWNLOADING_ASSETS",
        "GENERATING_VOICE",
        "GENERATING_TONES",
        "MIXING_AUDIO",
        "NORMALIZING",
        "UPLOADING",
      ];
      
      for (const stage of stages) {
        await tracker.startStage(stage as any);
        await tracker.completeStage();
      }
      
      expect(tracker.getTotalProgress()).toBe(100);
    });
  });

  describe("reset", () => {
    it("should reset all progress tracking", async () => {
      await tracker.startStage("MIXING_AUDIO");
      await tracker.updateStageProgress(0.5);
      
      tracker.reset();
      
      expect(tracker.getCurrentStage()).toBeNull();
      expect(tracker.getTotalProgress()).toBe(0);
      expect(tracker.getStageProgress()).toBe(0);
    });

    it("should emit reset event", () => {
      const resetHandler = vi.fn();
      mockEventEmitter.on("reset", resetHandler);
      
      tracker.reset();
      
      expect(resetHandler).toHaveBeenCalledWith({ jobId });
    });
  });

  describe("error handling", () => {
    it("should track stage errors", async () => {
      // Add error listener to prevent unhandled error
      mockEventEmitter.on('error', () => {});
      
      await tracker.startStage("GENERATING_VOICE");
      await tracker.setError(new Error("TTS API failed"));
      
      expect(tracker.hasErrors()).toBe(true);
      expect(tracker.getErrors()).toHaveLength(1);
      expect(tracker.getErrors()[0]).toMatchObject({
        stage: "GENERATING_VOICE",
        error: "TTS API failed",
      });
    });

    it("should emit error events", async () => {
      const errorHandler = vi.fn();
      mockEventEmitter.on("error", errorHandler);
      
      await tracker.startStage("UPLOADING");
      const testError = new Error("Storage quota exceeded");
      await tracker.setError(testError);
      
      expect(errorHandler).toHaveBeenCalledWith({
        jobId,
        stage: "UPLOADING",
        error: testError,
      });
    });
  });

  describe("summary", () => {
    it("should provide job processing summary", async () => {
      await tracker.startStage("INITIALIZING");
      await tracker.completeStage();
      
      await tracker.startStage("GENERATING_VOICE");
      await tracker.completeStage();
      
      const summary = tracker.getSummary();
      
      expect(summary).toMatchObject({
        jobId,
        totalProgress: expect.any(Number),
        completedStages: ["INITIALIZING", "GENERATING_VOICE"],
        currentStage: null,
        totalDuration: expect.any(Number),
        stageDurations: expect.any(Object),
        hasErrors: false,
      });
    });
  });

  describe("concurrency", () => {
    it("should handle concurrent stage updates safely", async () => {
      const promises = [];
      
      // Start multiple concurrent updates
      for (let i = 0; i < 10; i++) {
        promises.push(tracker.updateStageProgress(i / 10));
      }
      
      await Promise.all(promises);
      
      // Should maintain consistency
      expect(tracker.getStageProgress()).toBeGreaterThanOrEqual(0);
      expect(tracker.getStageProgress()).toBeLessThanOrEqual(1);
    });
  });
});