import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Get the audio processor function URL
const audioProcessorUrl = `${supabaseUrl}/functions/v1/audio-processor`

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Audio processor worker started')

    // Check for pending jobs
    const { data: pendingJobs, error: countError } = await supabase
      .from('audio_job_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (countError) {
      throw countError
    }

    const pendingCount = pendingJobs?.length || 0
    console.log(`Found ${pendingCount} pending jobs`)

    // Process up to 5 jobs in this invocation
    const maxJobs = Math.min(pendingCount, 5)
    const results = []

    for (let i = 0; i < maxJobs; i++) {
      try {
        // Call the audio processor function
        const response = await fetch(audioProcessorUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'process' }),
        })

        const result = await response.json()
        results.push(result)

        // Add a small delay between jobs to avoid overloading
        if (i < maxJobs - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`Error processing job ${i + 1}:`, error)
        results.push({ error: error.message })
      }
    }

    // Check for stuck jobs (processing for more than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: stuckJobs, error: stuckError } = await supabase
      .from('audio_job_queue')
      .select('id')
      .eq('status', 'processing')
      .lt('started_at', tenMinutesAgo)

    if (!stuckError && stuckJobs && stuckJobs.length > 0) {
      console.log(`Found ${stuckJobs.length} stuck jobs, resetting them`)

      // Reset stuck jobs back to pending
      for (const job of stuckJobs) {
        await supabase
          .from('audio_job_queue')
          .update({
            status: 'pending',
            started_at: null,
            progress: 0,
            stage: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
      }
    }

    // Return summary
    return new Response(
      JSON.stringify({
        message: 'Worker completed',
        processed: results.length,
        pending: pendingCount - results.length,
        stuck_reset: stuckJobs?.length || 0,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Worker error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})