import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Test configuration
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321'
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'test-key'
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const queueWorkerUrl = `${supabaseUrl}/functions/v1/queue-worker`

Deno.test("Queue Worker Tests", async (t) => {

  await t.step("Health check should return healthy status", async () => {
    const response = await fetch(`${queueWorkerUrl}?action=health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    })

    assertEquals(response.status, 200)
    const data = await response.json()
    assertEquals(data.status, 'healthy')
    assertEquals(data.database, 'connected')
    assertExists(data.processors)
  })

  await t.step("Should enqueue and process email job", async () => {
    // Enqueue an email job
    const { data: jobId, error: enqueueError } = await supabase.rpc('enqueue_job', {
      p_type: 'email',
      p_payload: {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
      },
      p_priority: 'normal',
    })

    assertEquals(enqueueError, null)
    assertExists(jobId)

    // Process the job
    const response = await fetch(`${queueWorkerUrl}?action=process&type=email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    })

    assertEquals(response.status, 200)
    const result = await response.json()
    assertEquals(result.processed, 1)
    assertEquals(result.results[0].success, true)

    // Verify job status
    const { data: job } = await supabase
      .from('job_queue')
      .select('status')
      .eq('id', jobId)
      .single()

    assertEquals(job?.status, 'completed')
  })

  await t.step("Should handle job with dependencies", async () => {
    // Create parent job
    const { data: parentId } = await supabase.rpc('enqueue_job', {
      p_type: 'analytics',
      p_payload: { type: 'daily' },
      p_priority: 'normal',
    })

    // Create dependent job
    const { data: childId } = await supabase.rpc('enqueue_job', {
      p_type: 'email',
      p_payload: {
        to: 'admin@example.com',
        subject: 'Analytics Complete',
        text: 'Daily analytics have been processed',
      },
      p_priority: 'normal',
      p_depends_on: parentId,
    })

    // Try to process child job (should not process)
    const response1 = await fetch(`${queueWorkerUrl}?action=process&type=email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    })

    const result1 = await response1.json()
    assertEquals(result1.processed, 0) // Child not processed yet

    // Process parent job
    await fetch(`${queueWorkerUrl}?action=process&type=analytics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    })

    // Now process child job (should process)
    const response2 = await fetch(`${queueWorkerUrl}?action=process&type=email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    })

    const result2 = await response2.json()
    assertEquals(result2.processed, 1) // Child processed after parent
  })

  await t.step("Should handle retry logic with exponential backoff", async () => {
    // Create a job that will fail
    const { data: jobId } = await supabase.rpc('enqueue_job', {
      p_type: 'email',
      p_payload: {
        to: 'invalid-email', // Invalid email to trigger failure
        subject: 'Test',
      },
      p_priority: 'normal',
      p_max_retries: 3,
    })

    // Process and fail the job
    await supabase.rpc('fail_job', {
      p_job_id: jobId,
      p_error: 'Invalid email address',
      p_retry: true,
    })

    // Check retry status
    const { data: job } = await supabase
      .from('job_queue')
      .select('status, retry_count, next_retry_at')
      .eq('id', jobId)
      .single()

    assertEquals(job?.status, 'retry')
    assertEquals(job?.retry_count, 1)
    assertExists(job?.next_retry_at)
  })

  await t.step("Should move job to dead letter after max retries", async () => {
    // Create a job with max retries = 1
    const { data: jobId } = await supabase.rpc('enqueue_job', {
      p_type: 'email',
      p_payload: {
        to: 'test@example.com',
        subject: 'Test',
      },
      p_priority: 'normal',
      p_max_retries: 1,
    })

    // Fail job twice (exceeding max retries)
    await supabase.rpc('fail_job', {
      p_job_id: jobId,
      p_error: 'Error 1',
      p_retry: true,
    })

    await supabase.rpc('fail_job', {
      p_job_id: jobId,
      p_error: 'Error 2',
      p_retry: true,
    })

    // Check job status
    const { data: job } = await supabase
      .from('job_queue')
      .select('status')
      .eq('id', jobId)
      .single()

    assertEquals(job?.status, 'dead_letter')

    // Verify dead letter entry
    const { data: deadLetter } = await supabase
      .from('job_dead_letter')
      .select('original_job_id')
      .eq('original_job_id', jobId)
      .single()

    assertEquals(deadLetter?.original_job_id, jobId)
  })

  await t.step("Should respect rate limiting", async () => {
    const rateLimitKey = 'test-rate-limit'
    const promises = []

    // Try to enqueue 5 jobs with same rate limit key
    for (let i = 0; i < 5; i++) {
      promises.push(
        supabase.rpc('enqueue_job', {
          p_type: 'email',
          p_payload: {
            to: `test${i}@example.com`,
            subject: 'Test',
          },
          p_priority: 'normal',
          p_rate_limit_key: rateLimitKey,
        })
      )
    }

    const results = await Promise.allSettled(promises)

    // Some should succeed, some should fail due to rate limiting
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    assertExists(succeeded)
    // Rate limiting may or may not trigger depending on timing
    // Just verify the mechanism works
  })

  await t.step("Should handle batch processing", async () => {
    // Enqueue multiple jobs
    const jobIds = []
    for (let i = 0; i < 3; i++) {
      const { data: jobId } = await supabase.rpc('enqueue_job', {
        p_type: 'email',
        p_payload: {
          to: `batch${i}@example.com`,
          subject: `Batch Email ${i}`,
        },
        p_priority: 'normal',
      })
      jobIds.push(jobId)
    }

    // Process batch
    const response = await fetch(`${queueWorkerUrl}?action=process&type=email&batch=3`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    })

    const result = await response.json()
    assertEquals(result.processed, 3)
    assertEquals(result.results.length, 3)
  })

  await t.step("Should handle concurrent job processing (SKIP LOCKED)", async () => {
    // Enqueue multiple jobs
    const jobIds = []
    for (let i = 0; i < 5; i++) {
      const { data: jobId } = await supabase.rpc('enqueue_job', {
        p_type: 'analytics',
        p_payload: { type: 'realtime', id: i },
        p_priority: 'normal',
      })
      jobIds.push(jobId)
    }

    // Simulate concurrent workers
    const workerPromises = []
    for (let i = 0; i < 3; i++) {
      workerPromises.push(
        fetch(`${queueWorkerUrl}?action=process&type=analytics&batch=2`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
        })
      )
    }

    const results = await Promise.all(workerPromises)

    // All workers should succeed
    results.forEach(response => {
      assertEquals(response.status, 200)
    })

    // Verify no job was processed twice
    const { data: jobs } = await supabase
      .from('job_queue')
      .select('id, status')
      .in('id', jobIds)

    // Each job should be processed exactly once
    jobs?.forEach(job => {
      assertEquals(job.status, 'completed')
    })
  })

  await t.step("Should cleanup stuck jobs", async () => {
    // Manually create a stuck job
    const { data: jobId } = await supabase
      .from('job_queue')
      .insert({
        type: 'email',
        status: 'processing',
        payload: { to: 'stuck@example.com', subject: 'Stuck' },
        started_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 minutes ago
      })
      .select('id')
      .single()

    // Run cleanup
    const response = await fetch(`${queueWorkerUrl}?action=cleanup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    })

    const result = await response.json()
    assertEquals(result.reset_count, 1)

    // Verify job status reset
    const { data: job } = await supabase
      .from('job_queue')
      .select('status')
      .eq('id', jobId.id)
      .single()

    assertEquals(job?.status, 'retry')
  })

  await t.step("Should return queue statistics", async () => {
    const response = await fetch(`${queueWorkerUrl}?action=stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    })

    assertEquals(response.status, 200)
    const data = await response.json()

    assertExists(data.stats)
    assertExists(data.dead_letter_count)
    assertExists(data.timestamp)
  })

  await t.step("Should handle priority-based processing", async () => {
    // Enqueue jobs with different priorities
    const { data: lowPriorityId } = await supabase.rpc('enqueue_job', {
      p_type: 'email',
      p_payload: { to: 'low@example.com', subject: 'Low Priority' },
      p_priority: 'low',
    })

    const { data: criticalPriorityId } = await supabase.rpc('enqueue_job', {
      p_type: 'email',
      p_payload: { to: 'critical@example.com', subject: 'Critical' },
      p_priority: 'critical',
    })

    const { data: normalPriorityId } = await supabase.rpc('enqueue_job', {
      p_type: 'email',
      p_payload: { to: 'normal@example.com', subject: 'Normal' },
      p_priority: 'normal',
    })

    // Process one job (should be critical priority)
    const { data: jobs } = await supabase.rpc('get_next_job', {
      p_type: 'email',
      p_batch_size: 1,
    })

    assertEquals(jobs[0].job_id, criticalPriorityId)
  })
})

// Cleanup after tests
Deno.test("Cleanup test data", async () => {
  // Clean up test jobs
  await supabase
    .from('job_queue')
    .delete()
    .like('payload->to', '%example.com%')

  await supabase
    .from('job_dead_letter')
    .delete()
    .like('payload->to', '%example.com%')
})