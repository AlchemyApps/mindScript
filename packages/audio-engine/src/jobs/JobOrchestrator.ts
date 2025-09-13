import { EventEmitter } from "events";
import { QueueManager } from "../queue/QueueManager";
import { AudioJobProcessor } from "./AudioJobProcessor";
import { ProgressTracker } from "./ProgressTracker";
import { TempFileManager } from "../utils/TempFileManager";
import type { AudioJobQueue, JobProgressUpdate } from "@mindscript/schemas";

interface OrchestratorConfig {
  queueManager: QueueManager;
  workerId: string;
  maxConcurrentJobs?: number;
  pollIntervalMs?: number;
  idleTimeoutMs?: number;
  statsIntervalMs?: number;
}

interface JobStatistics {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  averageProcessingTime: number;
  currentlyProcessing: number;
  uptime: number;
}

interface HealthStatus {
  status: "healthy" | "unhealthy";
  uptime: number;
  activeJobs: number;
  queueConnected: boolean;
  lastError?: string;
}

interface ProcessingJob {
  job: AudioJobQueue;
  processor: AudioJobProcessor;
  progressTracker: ProgressTracker;
  startTime: number;
  promise: Promise<void>;
}

/**
 * High-level coordinator for audio job processing
 */
export class JobOrchestrator extends EventEmitter {
  private queueManager: QueueManager;
  private workerId: string;
  private maxConcurrentJobs: number;
  private pollIntervalMs: number;
  private idleTimeoutMs: number;
  private statsIntervalMs: number;
  private processingJobs: Map<string, ProcessingJob>;
  private isRunning: boolean = false;
  private pollTimer?: NodeJS.Timeout;
  private idleTimer?: NodeJS.Timeout;
  private statsTimer?: NodeJS.Timeout;
  private startTime: number = 0;
  private statistics: JobStatistics;
  private lastError?: string;
  private shutdownPromise?: Promise<void>;

  constructor(config: OrchestratorConfig) {
    super();
    
    this.queueManager = config.queueManager;
    this.workerId = config.workerId;
    this.maxConcurrentJobs = config.maxConcurrentJobs ?? 2;
    this.pollIntervalMs = config.pollIntervalMs ?? 5000;
    this.idleTimeoutMs = config.idleTimeoutMs ?? 60000;
    this.statsIntervalMs = config.statsIntervalMs ?? 30000;
    this.processingJobs = new Map();
    
    this.statistics = {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      averageProcessingTime: 0,
      currentlyProcessing: 0,
      uptime: 0,
    };

    this.setupSignalHandlers();
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    
    // Start polling for jobs
    this.startPolling();
    
    // Start statistics reporting
    this.startStatsReporting();
    
    // Reset idle timer
    this.resetIdleTimer();
    
    this.emit("start", { workerId: this.workerId });
  }

  /**
   * Stop the orchestrator gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  /**
   * Perform graceful shutdown
   */
  private async performShutdown(): Promise<void> {
    this.isRunning = false;
    
    // Stop polling
    this.stopPolling();
    
    // Stop timers
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
    
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = undefined;
    }
    
    // Wait for all jobs to complete
    if (this.processingJobs.size > 0) {
      this.emit("shutdown", { 
        message: `Waiting for ${this.processingJobs.size} jobs to complete...` 
      });
      
      const promises = Array.from(this.processingJobs.values()).map(j => j.promise);
      await Promise.allSettled(promises);
    }
    
    // Cleanup processors
    for (const job of this.processingJobs.values()) {
      await job.processor.cleanup();
    }
    
    this.processingJobs.clear();
    this.emit("stop", { workerId: this.workerId });
  }

  /**
   * Check if the orchestrator is running
   */
  isRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the number of active jobs
   */
  getActiveJobCount(): number {
    return this.processingJobs.size;
  }

  /**
   * Get statistics
   */
  getStatistics(): JobStatistics {
    return {
      ...this.statistics,
      currentlyProcessing: this.processingJobs.size,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<HealthStatus> {
    let queueConnected = true;
    
    try {
      // Test queue connection
      await this.queueManager.getJob("test-connection");
    } catch {
      queueConnected = false;
    }

    const status: HealthStatus = {
      status: queueConnected && !this.lastError ? "healthy" : "unhealthy",
      uptime: Date.now() - this.startTime,
      activeJobs: this.processingJobs.size,
      queueConnected,
      lastError: this.lastError,
    };

    return status;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(jobId: string, progress: number, message?: string): Promise<void> {
    const update: JobProgressUpdate = {
      jobId,
      progress,
      message,
    };

    try {
      await this.queueManager.updateProgress(update);
    } catch (error) {
      this.emit("error", error);
    }
  }

  /**
   * Cancel a specific job
   */
  async cancelJob(jobId: string): Promise<void> {
    const processingJob = this.processingJobs.get(jobId);
    if (processingJob) {
      processingJob.processor.cancel();
      this.emit(`cancel:${jobId}`);
    }
  }

  /**
   * Start polling for jobs
   */
  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      await this.pollForJobs();
    }, this.pollIntervalMs);
    
    // Poll immediately
    this.pollForJobs();
  }

  /**
   * Stop polling for jobs
   */
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  /**
   * Poll for and process jobs
   */
  private async pollForJobs(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Check if we can process more jobs
    if (this.processingJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    try {
      // Get next job from queue
      const job = await this.queueManager.getNextJob(this.workerId);
      
      if (job) {
        this.resetIdleTimer();
        await this.processJob(job);
        
        // Immediately poll for more if we have capacity
        if (this.processingJobs.size < this.maxConcurrentJobs) {
          setImmediate(() => this.pollForJobs());
        }
      }
    } catch (error) {
      this.lastError = (error as Error).message;
      this.emit("error", error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: AudioJobQueue): Promise<void> {
    const startTime = Date.now();
    
    // Create processor and tracker for this job
    const progressTracker = new ProgressTracker(job.id, {
      updateCallback: async (update) => {
        await this.updateJobProgress(update.jobId, update.progress, update.message);
      },
    });
    
    const tempFileManager = new TempFileManager({
      prefix: `job-${job.id}`,
    });
    
    const processor = new AudioJobProcessor({
      progressTracker,
      tempFileManager,
    });

    // Create processing job entry
    const processingJob: ProcessingJob = {
      job,
      processor,
      progressTracker,
      startTime,
      promise: this.executeJob(job, processor),
    };

    this.processingJobs.set(job.id, processingJob);
    this.statistics.currentlyProcessing = this.processingJobs.size;
    
    this.emit("jobStart", { jobId: job.id, workerId: this.workerId });

    // Wait for completion
    try {
      await processingJob.promise;
    } finally {
      this.processingJobs.delete(job.id);
      this.statistics.currentlyProcessing = this.processingJobs.size;
    }
  }

  /**
   * Execute a job with error handling
   */
  private async executeJob(
    job: AudioJobQueue,
    processor: AudioJobProcessor
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await processor.processJob(job);
      
      if (result.isOk) {
        await this.queueManager.completeJob(job.id, {
          outputUrl: result.value.outputUrl,
          metadata: result.value.metadata,
        });
        
        this.statistics.successCount++;
        this.emit("jobComplete", { 
          jobId: job.id, 
          duration: Date.now() - startTime,
        });
      } else {
        await this.queueManager.failJob(job.id, result.error, {
          processingTime: Date.now() - startTime,
        });
        
        this.statistics.failureCount++;
        this.emit("jobFailed", { 
          jobId: job.id, 
          error: result.error,
        });
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      await this.queueManager.failJob(job.id, errorMessage, {
        processingTime: Date.now() - startTime,
        errorStack: (error as Error).stack,
      });
      
      this.statistics.failureCount++;
      this.emit("jobFailed", { 
        jobId: job.id, 
        error: errorMessage,
      });
    } finally {
      // Update statistics
      this.statistics.totalProcessed++;
      const processingTime = Date.now() - startTime;
      this.statistics.averageProcessingTime = 
        (this.statistics.averageProcessingTime * (this.statistics.totalProcessed - 1) + processingTime) / 
        this.statistics.totalProcessed;
      
      // Cleanup
      await processor.cleanup();
    }
  }

  /**
   * Reset idle timer
   */
  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    if (this.idleTimeoutMs > 0) {
      this.idleTimer = setTimeout(() => {
        if (this.processingJobs.size === 0) {
          this.emit("idle", { duration: this.idleTimeoutMs });
          this.stop();
        }
      }, this.idleTimeoutMs);
    }
  }

  /**
   * Start statistics reporting
   */
  private startStatsReporting(): void {
    if (this.statsIntervalMs > 0) {
      this.statsTimer = setInterval(() => {
        this.emit("statistics", this.getStatistics());
      }, this.statsIntervalMs);
    }
  }

  /**
   * Setup process signal handlers
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      this.emit("signal", { signal });
      await this.stop();
      process.exit(0);
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
    
    process.once("exit", () => {
      // Synchronous cleanup only
      for (const job of this.processingJobs.values()) {
        job.processor.cleanup().catch(() => {});
      }
    });
  }
}