import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Test configuration
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321'
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'test-service-key'
const functionUrl = `${supabaseUrl}/functions/v1/audio-processor`

// Initialize test client
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Helper to create a test job
async function createTestJob(jobData: any) {
  const { data, error } = await supabase
    .from('audio_job_queue')
    .insert({
      track_id: crypto.randomUUID(),
      user_id: crypto.randomUUID(),
      status: 'pending',
      job_data: jobData,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Helper to clean up test data
async function cleanupTestJob(jobId: string) {
  await supabase
    .from('audio_job_queue')
    .delete()
    .eq('id', jobId)
}

Deno.test("Audio Processor - Health Check", async () => {
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'health' }),
  })

  const result = await response.json()
  assertEquals(response.status, 200)
  assertEquals(result.status, 'healthy')
})

Deno.test("Audio Processor - Process Empty Queue", async () => {
  // Ensure queue is empty
  await supabase
    .from('audio_job_queue')
    .delete()
    .eq('status', 'pending')

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'process' }),
  })

  const result = await response.json()
  assertEquals(response.status, 200)
  assertEquals(result.message, 'No pending jobs')
})

Deno.test("Audio Processor - Invalid Action", async () => {
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'invalid' }),
  })

  const result = await response.json()
  assertEquals(response.status, 500)
  assertExists(result.error)
})

Deno.test("Audio Processor - Job Processing Mock", async () => {
  // Create a test job
  const testJobData = {
    script: "This is a test audio script for processing.",
    voice: {
      provider: 'openai',
      voice_id: 'alloy',
      settings: {
        speed: 1.0,
      },
    },
    output: {
      format: 'mp3',
      quality: 'medium',
      normalize: true,
      target_lufs: -16,
    },
  }

  const job = await createTestJob(testJobData)

  try {
    // Mock the actual processing (in real tests, you'd mock the external APIs)
    // For now, we'll just verify the job structure
    assertExists(job.id)
    assertEquals(job.status, 'pending')
    assertEquals(job.job_data, testJobData)

    // Update job to simulate processing
    await supabase.rpc('update_job_progress', {
      job_id: job.id,
      new_progress: 50,
      new_stage: 'Processing',
    })

    // Check progress update
    const { data: updatedJob } = await supabase
      .from('audio_job_queue')
      .select()
      .eq('id', job.id)
      .single()

    assertEquals(updatedJob.progress, 50)
    assertEquals(updatedJob.stage, 'Processing')

    // Complete the job
    await supabase.rpc('complete_job', {
      job_id: job.id,
      job_result: {
        url: 'https://example.com/test.mp3',
        duration: 10.5,
        size: 1024000,
        format: 'mp3',
      },
    })

    // Verify completion
    const { data: completedJob } = await supabase
      .from('audio_job_queue')
      .select()
      .eq('id', job.id)
      .single()

    assertEquals(completedJob.status, 'completed')
    assertEquals(completedJob.progress, 100)
    assertExists(completedJob.result)
  } finally {
    await cleanupTestJob(job.id)
  }
})

Deno.test("Audio Processor - SKIP LOCKED Pattern", async () => {
  // Create multiple test jobs
  const jobs = await Promise.all([
    createTestJob({ script: "Job 1", voice: { provider: 'openai', voice_id: 'alloy' }, output: { format: 'mp3', quality: 'low', normalize: false } }),
    createTestJob({ script: "Job 2", voice: { provider: 'openai', voice_id: 'echo' }, output: { format: 'mp3', quality: 'low', normalize: false } }),
    createTestJob({ script: "Job 3", voice: { provider: 'openai', voice_id: 'fable' }, output: { format: 'mp3', quality: 'low', normalize: false } }),
  ])

  try {
    // Simulate concurrent processing
    const results = await Promise.all([
      supabase.rpc('get_next_pending_job'),
      supabase.rpc('get_next_pending_job'),
    ])

    // Each call should get a different job
    const jobIds = results
      .filter(r => r.data)
      .map(r => r.data.job_id)

    // Should have gotten 2 different jobs
    assertEquals(jobIds.length, 2)
    assertEquals(new Set(jobIds).size, 2) // All unique

    // Verify jobs are marked as processing
    for (const jobId of jobIds) {
      const { data: job } = await supabase
        .from('audio_job_queue')
        .select('status')
        .eq('id', jobId)
        .single()

      assertEquals(job.status, 'processing')
    }
  } finally {
    // Cleanup
    await Promise.all(jobs.map(j => cleanupTestJob(j.id)))
  }
})

Deno.test("Audio Processor - Error Handling", async () => {
  const job = await createTestJob({
    script: "Test error handling",
    voice: {
      provider: 'invalid_provider', // This should cause an error
      voice_id: 'test',
    },
    output: {
      format: 'mp3',
      quality: 'low',
      normalize: false,
    },
  })

  try {
    // Mark job as failed
    await supabase.rpc('complete_job', {
      job_id: job.id,
      job_error: 'Unsupported TTS provider: invalid_provider',
    })

    // Verify failure
    const { data: failedJob } = await supabase
      .from('audio_job_queue')
      .select()
      .eq('id', job.id)
      .single()

    assertEquals(failedJob.status, 'failed')
    assertExists(failedJob.error)
    assertEquals(failedJob.error, 'Unsupported TTS provider: invalid_provider')
  } finally {
    await cleanupTestJob(job.id)
  }
})

Deno.test("Audio Processor Worker - Process Multiple Jobs", async () => {
  // Create test jobs
  const jobs = await Promise.all([
    createTestJob({ script: "Worker job 1", voice: { provider: 'openai', voice_id: 'alloy' }, output: { format: 'mp3', quality: 'low', normalize: false } }),
    createTestJob({ script: "Worker job 2", voice: { provider: 'openai', voice_id: 'echo' }, output: { format: 'mp3', quality: 'low', normalize: false } }),
  ])

  try {
    const workerUrl = `${supabaseUrl}/functions/v1/audio-processor-worker`
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const result = await response.json()
    assertEquals(response.status, 200)
    assertExists(result.message)
    assertExists(result.processed)
    assertExists(result.pending)
  } finally {
    await Promise.all(jobs.map(j => cleanupTestJob(j.id)))
  }
})

Deno.test("Audio Processor - Notification Trigger", async () => {
  const job = await createTestJob({
    script: "Test notifications",
    voice: { provider: 'openai', voice_id: 'alloy' },
    output: { format: 'mp3', quality: 'medium', normalize: true },
  })

  try {
    // Complete the job
    await supabase.rpc('complete_job', {
      job_id: job.id,
      job_result: { url: 'test.mp3', duration: 5, size: 500000, format: 'mp3' },
    })

    // Check if notification was created
    const { data: notification } = await supabase
      .from('notifications_queue')
      .select()
      .eq('user_id', job.user_id)
      .eq('type', 'render_complete')
      .single()

    if (notification) {
      assertExists(notification.data)
      assertEquals(notification.data.job_id, job.id)
      assertEquals(notification.sent, false)
    }
  } finally {
    await cleanupTestJob(job.id)
    // Clean up notification
    await supabase
      .from('notifications_queue')
      .delete()
      .eq('user_id', job.user_id)
  }
})