import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { QueueManager } from "./QueueManager";
import type { CreateAudioJob, JobProgressUpdate } from "@mindscript/schemas";

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
  })),
}));

describe("QueueManager", () => {
  let queueManager: QueueManager;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    queueManager = new QueueManager("http://localhost:54321", "test-key");
    // Get the mocked supabase instance
    mockSupabase = (queueManager as any).supabase;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("submitJob", () => {
    it("should submit a valid job to the queue", async () => {
      const mockJob = {
        id: "test-job-id",
        user_id: "test-user-id",
        project_id: "test-project-id",
        status: "pending",
        priority: "normal",
        payload: {
          type: "render",
          projectData: {
            scriptText: "Test script",
            voiceRef: "openai:alloy",
            durationMin: 10,
            pauseSec: 3,
            loopMode: "repeat",
            layers: {
              voice: { enabled: true, provider: "openai", voiceCode: "alloy" },
              background: { enabled: false },
              gains: { voiceDb: 0, bgDb: -10 },
            },
          },
          outputOptions: { format: "mp3", quality: "standard" },
        },
        progress: 0,
        created_at: new Date().toISOString(),
        retry_count: 0,
        max_retries: 3,
      };

      mockSupabase.from = vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
      }));

      const input: CreateAudioJob = {
        userId: "test-user-id",
        projectId: "test-project-id",
        priority: "normal",
        payload: {
          type: "render",
          projectData: {
            scriptText: "Test script",
            voiceRef: "openai:alloy",
            durationMin: 10,
            pauseSec: 3,
            loopMode: "repeat",
            layers: {
              voice: { enabled: true, provider: "openai", voiceCode: "alloy" },
              background: { enabled: false },
              gains: { voiceDb: 0, bgDb: -10 },
            },
          },
          outputOptions: { format: "mp3", quality: "standard" },
        },
      };

      const result = await queueManager.submitJob(input);

      expect(result).toBeDefined();
      expect(result.id).toBe("test-job-id");
      expect(result.status).toBe("pending");
      expect(mockSupabase.from).toHaveBeenCalledWith("audio_job_queue");
    });

    it("should throw error on invalid input", async () => {
      const invalidInput = {
        userId: "not-a-uuid",
        payload: {
          type: "invalid-type",
        },
      } as any;

      await expect(queueManager.submitJob(invalidInput)).rejects.toThrow();
    });
  });

  describe("getJob", () => {
    it("should retrieve a job by ID", async () => {
      const mockJob = {
        id: "test-job-id",
        user_id: "test-user-id",
        status: "processing",
        priority: "normal",
        payload: {},
        progress: 50,
        progress_message: "Processing audio",
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      };

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
      }));

      const result = await queueManager.getJob("test-job-id");

      expect(result).toBeDefined();
      expect(result?.id).toBe("test-job-id");
      expect(result?.progress).toBe(50);
      expect(mockSupabase.from).toHaveBeenCalledWith("audio_job_queue");
    });

    it("should return null for non-existent job", async () => {
      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "Not found" },
        }),
      }));

      const result = await queueManager.getJob("non-existent-id");
      expect(result).toBeNull();
    });
  });

  describe("updateProgress", () => {
    it("should update job progress", async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

      const update: JobProgressUpdate = {
        jobId: "test-job-id",
        progress: 75,
        message: "Mixing audio layers",
      };

      await queueManager.updateProgress(update);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("update_job_progress", {
        job_id: "test-job-id",
        new_progress: 75,
        message: "Mixing audio layers",
      });
    });

    it("should validate progress range", async () => {
      const invalidUpdate: JobProgressUpdate = {
        jobId: "test-job-id",
        progress: 150, // Invalid progress > 100
      };

      await expect(queueManager.updateProgress(invalidUpdate)).rejects.toThrow();
    });
  });

  describe("completeJob", () => {
    it("should mark job as completed", async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

      await queueManager.completeJob("test-job-id", {
        outputUrl: "https://storage.example.com/output.mp3",
        metadata: { duration: 600000 },
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith("complete_audio_job", {
        job_id: "test-job-id",
        result_metadata: {
          outputUrl: "https://storage.example.com/output.mp3",
          duration: 600000,
        },
      });
    });
  });

  describe("failJob", () => {
    it("should mark job as failed with error details", async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

      await queueManager.failJob(
        "test-job-id",
        "TTS API rate limit exceeded",
        { statusCode: 429, provider: "openai" }
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith("fail_audio_job", {
        job_id: "test-job-id",
        error_msg: "TTS API rate limit exceeded",
        error_data: { statusCode: 429, provider: "openai" },
      });
    });
  });

  describe("cancelJob", () => {
    it("should cancel a pending job", async () => {
      const mockCancelledJob = {
        id: "test-job-id",
        status: "cancelled",
      };

      mockSupabase.from = vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCancelledJob, error: null }),
      }));

      const result = await queueManager.cancelJob("test-job-id", "test-user-id");

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("audio_job_queue");
    });

    it("should return false if job cannot be cancelled", async () => {
      mockSupabase.from = vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "Not found" },
        }),
      }));

      const result = await queueManager.cancelJob("test-job-id", "test-user-id");
      expect(result).toBe(false);
    });
  });

  describe("listUserJobs", () => {
    it("should list jobs for a user with filtering", async () => {
      const mockJobs = [
        { id: "job-1", user_id: "test-user", status: "completed" },
        { id: "job-2", user_id: "test-user", status: "completed" },
      ];

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockJobs,
          error: null,
          count: 2,
        }),
      }));

      const result = await queueManager.listUserJobs("test-user", {
        status: "completed",
        limit: 10,
        offset: 0,
      });

      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockSupabase.from).toHaveBeenCalledWith("audio_job_queue");
    });
  });

  describe("subscribeToJob", () => {
    it("should subscribe to job status changes", () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn(),
      };

      mockSupabase.channel = vi.fn(() => mockChannel);

      const callback = vi.fn();
      const unsubscribe = queueManager.subscribeToJob("test-job-id", callback);

      expect(mockSupabase.channel).toHaveBeenCalledWith("job:test-job-id");
      expect(mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({
          event: "UPDATE",
          schema: "public",
          table: "audio_job_queue",
          filter: "id=eq.test-job-id",
        }),
        expect.any(Function)
      );

      // Test unsubscribe
      unsubscribe();
      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });
  });

  describe("getNextJob", () => {
    it("should get the next available job for processing", async () => {
      const mockJob = {
        id: "next-job-id",
        user_id: "test-user",
        status: "processing",
        priority: "high",
        payload: {},
      };

      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: mockJob, error: null });

      const result = await queueManager.getNextJob("worker-123");

      expect(result).toBeDefined();
      expect(result?.id).toBe("next-job-id");
      expect(result?.status).toBe("processing");
      expect(mockSupabase.rpc).toHaveBeenCalledWith("get_next_audio_job", {
        worker_id: "worker-123",
      });
    });

    it("should return null when no jobs available", async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

      const result = await queueManager.getNextJob("worker-123");
      expect(result).toBeNull();
    });
  });
});