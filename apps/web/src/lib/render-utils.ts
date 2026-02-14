import { createClient } from '@/lib/supabase/server'

/**
 * Verify that a render job belongs to the authenticated user.
 */
export async function verifyRenderOwnership(
  renderId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audio_job_queue')
    .select('user_id')
    .eq('id', renderId)
    .single()

  if (error || !data) return false
  return data.user_id === userId
}

/**
 * Get the current status of a render job.
 */
export async function getRenderJobStatus(renderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audio_job_queue')
    .select('id, track_id, user_id, status, progress, stage, error, result, created_at, updated_at')
    .eq('id', renderId)
    .single()

  if (error || !data) {
    throw new Error(`Render job not found: ${renderId}`)
  }

  return data
}

/**
 * Cancel a pending or processing render job.
 */
export async function cancelRenderJob(renderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audio_job_queue')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', renderId)
    .select('id, status, updated_at')
    .single()

  if (error || !data) {
    throw new Error(`Failed to cancel render job: ${renderId}`)
  }

  return data
}
