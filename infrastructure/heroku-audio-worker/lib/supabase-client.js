/**
 * Supabase Client Module
 * Handles database and storage operations for audio job processing
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let supabase = null;

/**
 * Initialize and return the Supabase client
 */
function getClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
}

/**
 * Get the next pending job from the queue
 * Uses the RPC function that implements SKIP LOCKED for concurrent worker safety
 */
async function getNextPendingJob() {
  const client = getClient();
  const { data, error } = await client.rpc('get_next_pending_job');

  if (error) {
    console.error('Error fetching next job:', error);
    return null;
  }

  // RPC returns array, we need the first item
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }

  return null;
}

/**
 * Update job progress
 * @param {string} jobId - The job ID
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} stage - Current processing stage
 */
async function updateJobProgress(jobId, progress, stage) {
  const client = getClient();
  const { error } = await client.rpc('update_job_progress', {
    job_id: jobId,
    new_progress: progress,
    new_stage: stage,
  });

  if (error) {
    console.error(`Error updating progress for job ${jobId}:`, error);
    return false;
  }

  return true;
}

/**
 * Complete a job with success or failure
 * @param {string} jobId - The job ID
 * @param {object|null} result - Result data (null if failed)
 * @param {string|null} errorMessage - Error message if failed
 */
async function completeJob(jobId, result, errorMessage = null) {
  const client = getClient();
  const { error } = await client.rpc('complete_job', {
    job_id: jobId,
    job_result: result,
    job_error: errorMessage,
  });

  if (error) {
    console.error(`Error completing job ${jobId}:`, error);
    return false;
  }

  return true;
}

/**
 * Upload rendered audio file to Supabase Storage
 * @param {string} filePath - Local path to the audio file
 * @param {string} trackId - Track ID for storage path
 * @param {string} format - Audio format (mp3 or wav)
 * @returns {Promise<{url: string, path: string}|null>}
 */
async function uploadRenderedAudio(filePath, trackId, format = 'mp3') {
  const client = getClient();
  const bucket = 'audio-renders';
  const storagePath = `tracks/${trackId}/rendered.${format}`;

  const MAX_RETRIES = 3;

  try {
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`[Upload] File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    // Upload to Supabase Storage with retry for network errors
    let data, error;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const result = await client.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, {
          contentType: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
          upsert: true,
        });

      data = result.data;
      error = result.error;

      if (!error) break;

      const isRetryable = error.message?.includes('fetch failed') ||
        error.message?.includes('EPIPE') ||
        error.message?.includes('ECONNRESET') ||
        error.statusCode >= 500;

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = attempt * 2000;
        console.log(`[Upload] Attempt ${attempt} failed (${error.message}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error(`[Upload] Failed after ${attempt} attempt(s):`, error);
        return null;
      }
    }

    // Get signed URL (valid for 1 year)
    const { data: urlData, error: urlError } = await client.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (urlError) {
      console.error('Error creating signed URL:', urlError);
      // Fall back to public URL if signed URL fails
      const { data: publicData } = client.storage
        .from(bucket)
        .getPublicUrl(storagePath);

      return {
        url: publicData.publicUrl,
        path: storagePath,
      };
    }

    return {
      url: urlData.signedUrl,
      path: storagePath,
    };
  } catch (err) {
    console.error('Error uploading audio:', err);
    return null;
  }
}

/**
 * Update track record with rendered audio URL
 * @param {string} trackId - Track ID
 * @param {string} audioUrl - URL of the rendered audio
 * @param {number} durationMs - Duration in milliseconds
 */
async function updateTrackAudio(trackId, audioUrl, durationMs) {
  const client = getClient();
  const { error } = await client
    .from('tracks')
    .update({
      audio_url: audioUrl,
      duration_seconds: Math.round(durationMs / 1000),
      status: 'published',
      updated_at: new Date().toISOString(),
    })
    .eq('id', trackId);

  if (error) {
    console.error(`Error updating track ${trackId}:`, error);
    return false;
  }

  return true;
}

/**
 * Download background music from storage
 * @param {string} musicUrl - URL of the background music
 * @param {string} outputPath - Local path to save the file
 */
async function downloadBackgroundMusic(musicUrl, outputPath) {
  const client = getClient();

  try {
    // If it's a Supabase storage URL, extract the path
    if (musicUrl.includes('supabase')) {
      const urlParts = new URL(musicUrl);
      const pathMatch = urlParts.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^?]+)/);

      if (pathMatch) {
        const storagePath = decodeURIComponent(pathMatch[1]);
        const bucketName = storagePath.split('/')[0];
        const filePath = storagePath.split('/').slice(1).join('/');

        const { data, error } = await client.storage
          .from(bucketName)
          .download(filePath);

        if (error) throw error;

        const buffer = Buffer.from(await data.arrayBuffer());
        fs.writeFileSync(outputPath, buffer);
        return true;
      }
    }

    // Fall back to HTTP download for external URLs
    const response = await fetch(musicUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (err) {
    console.error('Error downloading background music:', err);
    return false;
  }
}

module.exports = {
  getClient,
  getNextPendingJob,
  updateJobProgress,
  completeJob,
  uploadRenderedAudio,
  updateTrackAudio,
  downloadBackgroundMusic,
};
