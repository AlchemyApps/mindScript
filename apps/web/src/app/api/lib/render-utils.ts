import { RenderJobStatus } from "@mindscript/schemas";
import { createServiceRoleClient } from "@mindscript/auth/server";

export const supabaseAdmin = createServiceRoleClient();

/**
 * Check if user owns the track
 */
export async function verifyTrackOwnership(trackId: string, userId: string): Promise<boolean> {
  const { data: track, error } = await supabaseAdmin
    .from('tracks')
    .select('user_id')
    .eq('id', trackId)
    .single();

  if (error || !track) {
    return false;
  }

  return track.user_id === userId;
}

/**
 * Check if user owns the render job
 */
export async function verifyRenderOwnership(renderId: string, userId: string): Promise<boolean> {
  const { data: render, error } = await supabaseAdmin
    .from('audio_job_queue')
    .select('user_id')
    .eq('id', renderId)
    .single();

  if (error || !render) {
    return false;
  }

  return render.user_id === userId;
}

/**
 * Check for existing pending/processing render jobs for a track
 */
export async function getExistingRenderJob(trackId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('audio_job_queue')
    .select('*')
    .eq('track_id', trackId)
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to check existing renders: ${error.message}`);
  }

  return data?.[0] || null;
}

/**
 * Create a new render job in the queue
 */
export async function createRenderJob(params: {
  trackId: string;
  userId: string;
  jobData: Record<string, any>;
}) {
  const { trackId, userId, jobData } = params;

  const { data, error } = await supabaseAdmin
    .from('audio_job_queue')
    .insert({
      track_id: trackId,
      user_id: userId,
      status: 'pending' as RenderJobStatus,
      progress: 0,
      job_data: jobData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create render job: ${error.message}`);
  }

  return data;
}

/**
 * Get render job status
 */
export async function getRenderJobStatus(renderId: string) {
  const { data, error } = await supabaseAdmin
    .from('audio_job_queue')
    .select('*')
    .eq('id', renderId)
    .single();

  if (error) {
    throw new Error(`Failed to get render status: ${error.message}`);
  }

  return data;
}

/**
 * Cancel a render job
 */
export async function cancelRenderJob(renderId: string) {
  const { data, error } = await supabaseAdmin
    .from('audio_job_queue')
    .update({
      status: 'cancelled' as RenderJobStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', renderId)
    .eq('status', 'pending') // Only allow cancelling pending jobs
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel render job: ${error.message}`);
  }

  return data;
}

/**
 * Generate signed URL for audio download
 */
export async function generateDownloadUrl(audioPath: string, expiresIn: number = 3600) {
  const { data, error } = await supabaseAdmin.storage
    .from('audio-tracks')
    .createSignedUrl(audioPath, expiresIn);

  if (error) {
    throw new Error(`Failed to generate download URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Get track download info
 */
export async function getTrackDownloadInfo(trackId: string) {
  const { data, error } = await supabaseAdmin
    .from('tracks')
    .select('audio_url, status')
    .eq('id', trackId)
    .single();

  if (error) {
    throw new Error(`Failed to get track info: ${error.message}`);
  }

  return data;
}

/**
 * Update download count for track
 */
export async function incrementDownloadCount(trackId: string) {
  const { error } = await supabaseAdmin.rpc('increment_download_count', {
    track_id: trackId
  });

  if (error) {
    console.error('Failed to increment download count:', error);
    // Don't throw error as this is non-critical
  }
}

/**
 * Invoke Edge Function to process render job
 */
export async function invokeRenderProcessor(jobId: string) {
  const { data, error } = await supabaseAdmin.functions.invoke('render-audio', {
    body: { jobId }
  });

  if (error) {
    throw new Error(`Failed to invoke render processor: ${error.message}`);
  }

  return data;
}