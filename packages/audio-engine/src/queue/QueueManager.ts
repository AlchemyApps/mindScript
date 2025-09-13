import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  CreateAudioJobSchema,
  JobProgressUpdateSchema,
  type CreateAudioJob,
  type JobProgressUpdate,
  type AudioJobQueue,
  type JobResult,
  type JobStatus,
} from "@mindscript/schemas";

export class QueueManager {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Submit a new job to the queue
   */
  async submitJob(input: CreateAudioJob): Promise<AudioJobQueue> {
    // Validate input
    const validated = CreateAudioJobSchema.parse(input);

    const { data, error } = await this.supabase
      .from("audio_job_queue")
      .insert({
        user_id: validated.userId,
        project_id: validated.projectId,
        priority: validated.priority,
        payload: validated.payload,
        metadata: validated.metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to submit job: ${error.message}`);
    }

    return this.mapDatabaseToJobQueue(data);
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<AudioJobQueue | null> {
    const { data, error } = await this.supabase
      .from("audio_job_queue")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Job not found
      }
      throw new Error(`Failed to get job: ${error.message}`);
    }

    return this.mapDatabaseToJobQueue(data);
  }

  /**
   * Get the next available job for processing (worker side)
   */
  async getNextJob(workerId: string): Promise<AudioJobQueue | null> {
    const { data, error } = await this.supabase
      .rpc("get_next_audio_job", { worker_id: workerId });

    if (error) {
      throw new Error(`Failed to get next job: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.mapDatabaseToJobQueue(data);
  }

  /**
   * Update job progress
   */
  async updateProgress(update: JobProgressUpdate): Promise<void> {
    const validated = JobProgressUpdateSchema.parse(update);

    const { error } = await this.supabase
      .rpc("update_job_progress", {
        job_id: validated.jobId,
        new_progress: validated.progress,
        message: validated.message,
      });

    if (error) {
      throw new Error(`Failed to update progress: ${error.message}`);
    }
  }

  /**
   * Complete a job successfully
   */
  async completeJob(jobId: string, result: Partial<JobResult>): Promise<void> {
    const metadata = {
      outputUrl: result.outputUrl,
      ...result.metadata,
    };

    const { error } = await this.supabase
      .rpc("complete_audio_job", {
        job_id: jobId,
        result_metadata: metadata,
      });

    if (error) {
      throw new Error(`Failed to complete job: ${error.message}`);
    }
  }

  /**
   * Mark a job as failed
   */
  async failJob(
    jobId: string,
    errorMessage: string,
    errorDetails?: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.supabase
      .rpc("fail_audio_job", {
        job_id: jobId,
        error_msg: errorMessage,
        error_data: errorDetails,
      });

    if (error) {
      throw new Error(`Failed to mark job as failed: ${error.message}`);
    }
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(jobId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("audio_job_queue")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return false; // Job not found or not cancellable
      }
      throw new Error(`Failed to cancel job: ${error.message}`);
    }

    return !!data;
  }

  /**
   * List jobs for a user with filtering
   */
  async listUserJobs(
    userId: string,
    options?: {
      status?: JobStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ jobs: AudioJobQueue[]; total: number }> {
    let query = this.supabase
      .from("audio_job_queue")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list jobs: ${error.message}`);
    }

    return {
      jobs: data?.map(this.mapDatabaseToJobQueue) || [],
      total: count || 0,
    };
  }

  /**
   * Clean up stale jobs (admin function)
   */
  async cleanupStaleJobs(): Promise<number> {
    const { data, error } = await this.supabase
      .rpc("cleanup_stale_audio_jobs");

    if (error) {
      throw new Error(`Failed to cleanup stale jobs: ${error.message}`);
    }

    return data || 0;
  }

  /**
   * Subscribe to job status changes
   */
  subscribeToJob(
    jobId: string,
    callback: (job: AudioJobQueue) => void
  ): () => void {
    const subscription = this.supabase
      .channel(`job:${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "audio_job_queue",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          callback(this.mapDatabaseToJobQueue(payload.new));
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Map database record to AudioJobQueue type
   */
  private mapDatabaseToJobQueue(data: any): AudioJobQueue {
    return {
      id: data.id,
      userId: data.user_id,
      projectId: data.project_id,
      renderId: data.render_id,
      status: data.status as JobStatus,
      priority: data.priority,
      payload: data.payload,
      progress: data.progress || 0,
      progressMessage: data.progress_message,
      createdAt: new Date(data.created_at),
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      retryCount: data.retry_count || 0,
      maxRetries: data.max_retries || 3,
      errorMessage: data.error_message,
      errorDetails: data.error_details,
      lockedAt: data.locked_at ? new Date(data.locked_at) : undefined,
      lockedBy: data.locked_by,
      metadata: data.metadata,
    };
  }
}