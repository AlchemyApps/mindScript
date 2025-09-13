import { EventEmitter } from "events";
import type { JobProgressUpdate } from "@mindscript/schemas";

/**
 * Progress stages with their respective weights
 */
export const PROGRESS_STAGES = {
  INITIALIZING: { weight: 5, message: "Initializing job" },
  DOWNLOADING_ASSETS: { weight: 10, message: "Downloading assets" },
  GENERATING_VOICE: { weight: 30, message: "Generating voice" },
  GENERATING_TONES: { weight: 10, message: "Creating tones" },
  MIXING_AUDIO: { weight: 25, message: "Mixing audio layers" },
  NORMALIZING: { weight: 10, message: "Normalizing audio" },
  UPLOADING: { weight: 10, message: "Uploading to storage" },
} as const;

export type ProgressStage = keyof typeof PROGRESS_STAGES;

interface StageProgress {
  stage: ProgressStage;
  progress: number; // 0-1 within the stage
  startTime: number;
  endTime?: number;
  complete: boolean;
}

interface ProgressTrackerOptions {
  updateCallback?: (update: JobProgressUpdate) => Promise<void>;
  eventEmitter?: EventEmitter;
  autoAdvance?: boolean;
  throttleMs?: number;
}

interface TrackerError {
  stage: ProgressStage;
  error: string;
  timestamp: number;
}

interface ProgressSummary {
  jobId: string;
  totalProgress: number;
  completedStages: ProgressStage[];
  currentStage: ProgressStage | null;
  totalDuration: number;
  stageDurations: Record<string, number>;
  hasErrors: boolean;
}

/**
 * Tracks and manages progress for audio job processing
 */
export class ProgressTracker {
  private jobId: string;
  private stages: Map<ProgressStage, StageProgress>;
  private currentStage: ProgressStage | null = null;
  private updateCallback?: (update: JobProgressUpdate) => Promise<void>;
  private eventEmitter?: EventEmitter;
  private autoAdvance: boolean;
  private throttleMs: number;
  private lastUpdateTime: number = 0;
  private errors: TrackerError[] = [];
  private startTime: number;
  private customMessage: string | null = null;

  constructor(jobId: string, options?: ProgressTrackerOptions) {
    this.jobId = jobId;
    this.updateCallback = options?.updateCallback;
    this.eventEmitter = options?.eventEmitter;
    this.autoAdvance = options?.autoAdvance ?? false;
    this.throttleMs = options?.throttleMs ?? 500;
    this.stages = new Map();
    this.startTime = Date.now();
  }

  /**
   * Start a new stage
   */
  async startStage(stage: ProgressStage): Promise<void> {
    if (!PROGRESS_STAGES[stage]) {
      throw new Error(`Invalid stage: ${stage}`);
    }

    // Don't auto-complete if we're setting the same stage
    if (this.currentStage === stage) {
      return;
    }

    // Complete previous stage if auto-advance is enabled
    if (this.autoAdvance && this.currentStage && this.currentStage !== stage) {
      await this.completeStage();
    }

    this.currentStage = stage;
    this.stages.set(stage, {
      stage,
      progress: 0,
      startTime: Date.now(),
      complete: false,
    });

    await this.sendUpdate();
    this.emitEvent("stageStart", { stage });
  }

  /**
   * Update progress within current stage
   */
  async updateStageProgress(progress: number): Promise<void> {
    if (!this.currentStage) {
      return;
    }

    const clampedProgress = Math.max(0, Math.min(1, progress));
    const stageProgress = this.stages.get(this.currentStage);
    
    if (stageProgress) {
      stageProgress.progress = clampedProgress;
      await this.sendUpdate();
    }
  }

  /**
   * Complete the current stage
   */
  async completeStage(): Promise<void> {
    if (!this.currentStage) {
      return;
    }

    const completedStage = this.currentStage;
    const stageProgress = this.stages.get(completedStage);
    if (stageProgress) {
      stageProgress.progress = 1;
      stageProgress.complete = true;
      stageProgress.endTime = Date.now();
      
      const duration = stageProgress.endTime - stageProgress.startTime;
      this.emitEvent("stageComplete", { 
        jobId: this.jobId,
        stage: completedStage,
        duration,
      });
    }

    const nextStage = this.getNextStage();
    
    if (this.autoAdvance && nextStage) {
      this.currentStage = null; // Clear before starting next to avoid recursion
      await this.startStage(nextStage);
    } else {
      this.currentStage = null;
    }

    await this.sendUpdate();
  }

  /**
   * Set a custom progress message
   */
  async setCustomMessage(message: string | null): Promise<void> {
    this.customMessage = message;
    await this.sendUpdate(true); // Force update for message changes
  }

  /**
   * Get the current progress message
   */
  private getCurrentMessage(): string {
    if (this.customMessage) {
      return this.customMessage;
    }
    
    if (this.currentStage) {
      return PROGRESS_STAGES[this.currentStage].message;
    }
    
    return "Processing";
  }

  /**
   * Calculate total progress across all stages
   */
  getTotalProgress(): number {
    let totalProgress = 0;
    const stageOrder = Object.keys(PROGRESS_STAGES) as ProgressStage[];

    for (const stage of stageOrder) {
      const stageWeight = PROGRESS_STAGES[stage].weight;
      const stageProgress = this.stages.get(stage);

      if (stageProgress) {
        if (stageProgress.complete) {
          totalProgress += stageWeight;
        } else {
          totalProgress += stageWeight * stageProgress.progress;
        }
      } else if (this.currentStage && stageOrder.indexOf(stage) < stageOrder.indexOf(this.currentStage)) {
        // If we've passed this stage, count it as complete
        totalProgress += stageWeight;
      }
    }

    return Math.round(totalProgress);
  }

  /**
   * Get progress for the current stage
   */
  getStageProgress(): number {
    if (!this.currentStage) {
      // Check if we have any completed stages
      for (const [, progress] of this.stages) {
        if (progress.complete) {
          return 1;
        }
      }
      return 0;
    }
    
    const stageProgress = this.stages.get(this.currentStage);
    return stageProgress?.progress ?? 0;
  }

  /**
   * Get current progress as a value between 0-100
   */
  getProgress(): number {
    const stageOrder = Object.keys(PROGRESS_STAGES) as ProgressStage[];
    let cumulativeProgress = 0;
    let foundCurrent = false;

    for (const stage of stageOrder) {
      const stageWeight = PROGRESS_STAGES[stage].weight;
      const stageProgress = this.stages.get(stage);
      
      if (stage === this.currentStage) {
        foundCurrent = true;
        // Add partial progress for current stage
        const currentProgress = stageProgress?.progress ?? 0;
        cumulativeProgress += stageWeight * currentProgress;
      } else if (stageProgress?.complete) {
        // Add full weight for completed stages
        cumulativeProgress += stageWeight;
      } else if (!foundCurrent && this.currentStage) {
        // If we haven't reached the current stage yet, this stage must be complete
        const currentIndex = stageOrder.indexOf(this.currentStage);
        const stageIndex = stageOrder.indexOf(stage);
        if (stageIndex < currentIndex) {
          cumulativeProgress += stageWeight;
        }
      }
    }

    return Math.round(cumulativeProgress);
  }

  /**
   * Get the current stage
   */
  getCurrentStage(): ProgressStage | null {
    return this.currentStage;
  }

  /**
   * Get all stages configuration
   */
  getStages(): typeof PROGRESS_STAGES {
    return PROGRESS_STAGES;
  }

  /**
   * Check if a stage is complete
   */
  isStageComplete(stage: ProgressStage): boolean {
    return this.stages.get(stage)?.complete ?? false;
  }

  /**
   * Get elapsed time for a stage in milliseconds
   */
  getElapsedTime(stage: ProgressStage): number {
    const stageProgress = this.stages.get(stage);
    if (!stageProgress) {
      return 0;
    }

    if (stageProgress.endTime) {
      return stageProgress.endTime - stageProgress.startTime;
    }

    return Date.now() - stageProgress.startTime;
  }

  /**
   * Set an error for the current stage
   */
  async setError(error: Error): Promise<void> {
    if (!this.currentStage) {
      return;
    }

    this.errors.push({
      stage: this.currentStage,
      error: error.message,
      timestamp: Date.now(),
    });

    this.emitEvent("error", {
      jobId: this.jobId,
      stage: this.currentStage,
      error,
    });
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get all errors
   */
  getErrors(): TrackerError[] {
    return [...this.errors];
  }

  /**
   * Get a summary of the progress
   */
  getSummary(): ProgressSummary {
    const completedStages: ProgressStage[] = [];
    const stageDurations: Record<string, number> = {};

    for (const [stage, progress] of this.stages.entries()) {
      if (progress.complete) {
        completedStages.push(stage);
        stageDurations[stage] = this.getElapsedTime(stage);
      }
    }

    return {
      jobId: this.jobId,
      totalProgress: this.getTotalProgress(),
      completedStages,
      currentStage: this.currentStage,
      totalDuration: Date.now() - this.startTime,
      stageDurations,
      hasErrors: this.hasErrors(),
    };
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.stages.clear();
    this.currentStage = null;
    this.errors = [];
    this.customMessage = null;
    this.startTime = Date.now();
    this.emitEvent("reset", { jobId: this.jobId });
  }

  /**
   * Get the next stage in sequence
   */
  private getNextStage(): ProgressStage | null {
    if (!this.currentStage) {
      return null;
    }

    const stageOrder = Object.keys(PROGRESS_STAGES) as ProgressStage[];
    const currentIndex = stageOrder.indexOf(this.currentStage);
    
    if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
      return stageOrder[currentIndex + 1];
    }

    return null;
  }

  /**
   * Send update via callback (throttled)
   */
  private async sendUpdate(force: boolean = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastUpdateTime < this.throttleMs) {
      return;
    }

    this.lastUpdateTime = now;

    if (this.updateCallback) {
      await this.updateCallback({
        jobId: this.jobId,
        progress: this.getTotalProgress(),
        message: this.getCurrentMessage(),
      });
    }

    this.emitEvent("progress", {
      jobId: this.jobId,
      stage: this.currentStage,
      progress: this.getTotalProgress(),
      message: this.getCurrentMessage(),
    });
  }

  /**
   * Emit an event if event emitter is configured
   */
  private emitEvent(event: string, data: any): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit(event, data);
    }
  }
}