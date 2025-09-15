import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Base processor class that all job processors should extend
 */
export abstract class BaseProcessor {
  protected supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  /**
   * Process a job
   * @param jobId - The unique job ID
   * @param payload - The job payload data
   * @param metadata - Additional job metadata
   * @returns The result of the job processing
   */
  abstract process(jobId: string, payload: any, metadata: any): Promise<any>

  /**
   * Health check for the processor
   * @returns true if healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    return true
  }

  /**
   * Update job progress
   */
  protected async updateProgress(jobId: string, progress: number, stage?: string): Promise<void> {
    const { error } = await this.supabase.rpc('update_job_progress', {
      p_job_id: jobId,
      p_progress: progress,
      p_stage: stage,
    })

    if (error) {
      console.error(`Failed to update progress for job ${jobId}:`, error)
    }
  }

  /**
   * Validate payload against expected schema
   */
  protected validatePayload(payload: any, requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (!(field in payload)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }
  }

  /**
   * Circuit breaker pattern for external service calls
   */
  protected async withCircuitBreaker<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    backoffMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        console.error(`Attempt ${i + 1} failed:`, error)

        if (i < maxRetries - 1) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, i)))
        }
      }
    }

    throw lastError || new Error('Circuit breaker: max retries exceeded')
  }
}