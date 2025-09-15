import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

// Import processors
import { EmailProcessor } from "./processors/email.ts"
import { AudioProcessor } from "./processors/audio.ts"
import { PayoutProcessor } from "./processors/payout.ts"
import { AnalyticsProcessor } from "./processors/analytics.ts"

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Processor registry
const processors = {
  email: new EmailProcessor(supabase),
  audio_render: new AudioProcessor(supabase),
  payout: new PayoutProcessor(supabase),
  analytics: new AnalyticsProcessor(supabase),
}

// Job processing configuration
const CONFIG = {
  MAX_BATCH_SIZE: 5,
  STUCK_JOB_TIMEOUT_MINUTES: 10,
  MAX_PROCESSING_TIME_MS: 540000, // 9 minutes (Edge Function timeout is 10 min)
  HEALTH_CHECK_INTERVAL_MS: 30000, // 30 seconds
}

interface JobData {
  job_id: string
  job_type: string
  job_payload: any
  job_metadata: any
}

interface ProcessResult {
  success: boolean
  result?: any
  error?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // Parse request to determine action
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'process'
    const jobType = url.searchParams.get('type') as keyof typeof processors | null
    const batchSize = Math.min(
      parseInt(url.searchParams.get('batch') || '1'),
      CONFIG.MAX_BATCH_SIZE
    )

    console.log(`Queue worker started: action=${action}, type=${jobType}, batch=${batchSize}`)

    // Handle different actions
    switch (action) {
      case 'process':
        return await processJobs(jobType, batchSize, startTime)

      case 'cleanup':
        return await cleanupStuckJobs()

      case 'health':
        return await healthCheck()

      case 'stats':
        return await getQueueStats(jobType)

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    console.error('Queue worker error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function processJobs(
  jobType: keyof typeof processors | null,
  batchSize: number,
  startTime: number
): Promise<Response> {
  const results: ProcessResult[] = []
  let processedCount = 0

  try {
    // Get next batch of jobs
    const { data: jobs, error } = await supabase.rpc('get_next_job', {
      p_type: jobType,
      p_batch_size: batchSize,
    })

    if (error) {
      throw error
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No pending jobs found',
          type: jobType || 'all',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Processing ${jobs.length} jobs`)

    // Process jobs with timeout protection
    for (const job of jobs as JobData[]) {
      // Check if we're approaching Edge Function timeout
      if (Date.now() - startTime > CONFIG.MAX_PROCESSING_TIME_MS) {
        console.log('Approaching timeout, stopping job processing')
        break
      }

      const result = await processJob(job)
      results.push(result)
      processedCount++

      // Add small delay between jobs to prevent overwhelming resources
      if (processedCount < jobs.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Return summary
    return new Response(
      JSON.stringify({
        message: 'Batch processing completed',
        processed: processedCount,
        total: jobs.length,
        results: results.map(r => ({
          success: r.success,
          error: r.error,
        })),
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Batch processing error:', error)
    throw error
  }
}

async function processJob(job: JobData): Promise<ProcessResult> {
  const { job_id, job_type, job_payload, job_metadata } = job

  try {
    console.log(`Processing job ${job_id} of type ${job_type}`)

    // Get the appropriate processor
    const processor = processors[job_type as keyof typeof processors]
    if (!processor) {
      throw new Error(`No processor found for job type: ${job_type}`)
    }

    // Process the job
    const result = await processor.process(job_id, job_payload, job_metadata)

    // Mark job as completed
    const { error: completeError } = await supabase.rpc('complete_job', {
      p_job_id: job_id,
      p_result: result,
    })

    if (completeError) {
      throw completeError
    }

    console.log(`Job ${job_id} completed successfully`)
    return { success: true, result }

  } catch (error) {
    console.error(`Job ${job_id} failed:`, error)

    // Mark job as failed with retry logic
    const { error: failError } = await supabase.rpc('fail_job', {
      p_job_id: job_id,
      p_error: error.message || 'Unknown error',
      p_retry: true,
    })

    if (failError) {
      console.error('Failed to update job status:', failError)
    }

    return { success: false, error: error.message }
  }
}

async function cleanupStuckJobs(): Promise<Response> {
  try {
    const { data: count, error } = await supabase.rpc('cleanup_stuck_jobs', {
      p_timeout_minutes: CONFIG.STUCK_JOB_TIMEOUT_MINUTES,
    })

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        message: 'Stuck jobs cleanup completed',
        reset_count: count,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Cleanup error:', error)
    throw error
  }
}

async function healthCheck(): Promise<Response> {
  try {
    // Check database connectivity
    const { error: dbError } = await supabase
      .from('job_queue')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    if (dbError) {
      throw dbError
    }

    // Check each processor health
    const processorHealth: Record<string, boolean> = {}
    for (const [name, processor] of Object.entries(processors)) {
      try {
        processorHealth[name] = await processor.healthCheck()
      } catch (error) {
        processorHealth[name] = false
      }
    }

    return new Response(
      JSON.stringify({
        status: 'healthy',
        database: 'connected',
        processors: processorHealth,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function getQueueStats(jobType: keyof typeof processors | null): Promise<Response> {
  try {
    // Build query
    let query = supabase
      .from('job_queue')
      .select('status, type', { count: 'exact' })

    if (jobType) {
      query = query.eq('type', jobType)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    // Aggregate stats by status and type
    const stats: Record<string, Record<string, number>> = {}

    for (const row of data || []) {
      if (!stats[row.type]) {
        stats[row.type] = {}
      }
      stats[row.type][row.status] = (stats[row.type][row.status] || 0) + 1
    }

    // Get dead letter count
    const { count: deadLetterCount } = await supabase
      .from('job_dead_letter')
      .select('*', { count: 'exact', head: true })

    return new Response(
      JSON.stringify({
        stats,
        dead_letter_count: deadLetterCount || 0,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Stats error:', error)
    throw error
  }
}