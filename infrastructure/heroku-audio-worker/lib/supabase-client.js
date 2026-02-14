/**
 * Supabase Client Module
 * Handles database and storage operations for audio job processing.
 *
 * Supports dual-environment mode: a single worker instance can serve
 * both dev and prod Supabase projects via createEnvironmentClient().
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Legacy singleton for backwards compatibility
let legacyClient = null;

/**
 * Create an environment-scoped Supabase client with all worker operations bound to it.
 * @param {string} url - Supabase project URL
 * @param {string} serviceRoleKey - Supabase service role key
 * @param {string} envName - Environment label (e.g. 'DEV', 'PROD')
 * @returns {object} Object with client and all bound operations
 */
function createEnvironmentClient(url, serviceRoleKey, envName) {
  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  async function getNextPendingJob() {
    const { data, error } = await client.rpc('get_next_pending_job');

    if (error) {
      console.error(`[${envName}] Error fetching next job:`, error);
      return null;
    }

    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }

    return null;
  }

  async function updateJobProgress(jobId, progress, stage) {
    const { error } = await client.rpc('update_job_progress', {
      job_id: jobId,
      new_progress: progress,
      new_stage: stage,
    });

    if (error) {
      console.error(`[${envName}] Error updating progress for job ${jobId}:`, error);
      return false;
    }

    return true;
  }

  async function completeJob(jobId, result, errorMessage = null) {
    const { error } = await client.rpc('complete_job', {
      job_id: jobId,
      job_result: result,
      job_error: errorMessage,
    });

    if (error) {
      console.error(`[${envName}] Error completing job ${jobId}:`, error);
      return false;
    }

    return true;
  }

  async function uploadRenderedAudio(filePath, trackId, format = 'mp3') {
    const bucket = 'audio-renders';
    const storagePath = `tracks/${trackId}/rendered.${format}`;

    const MAX_RETRIES = 3;

    try {
      const fileBuffer = fs.readFileSync(filePath);
      console.log(`[${envName}] [Upload] File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);

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
          console.log(`[${envName}] [Upload] Attempt ${attempt} failed (${error.message}), retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          console.error(`[${envName}] [Upload] Failed after ${attempt} attempt(s):`, error);
          return null;
        }
      }

      const { data: urlData, error: urlError } = await client.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

      if (urlError) {
        console.error(`[${envName}] Error creating signed URL:`, urlError);
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
      console.error(`[${envName}] Error uploading audio:`, err);
      return null;
    }
  }

  async function updateTrackAudio(trackId, audioUrl, durationMs) {
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
      console.error(`[${envName}] Error updating track ${trackId}:`, error);
      return false;
    }

    return true;
  }

  async function downloadBackgroundMusic(musicUrl, outputPath) {
    try {
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
      console.error(`[${envName}] Error downloading background music:`, err);
      return false;
    }
  }

  return {
    client,
    envName,
    getNextPendingJob,
    updateJobProgress,
    completeJob,
    uploadRenderedAudio,
    updateTrackAudio,
    downloadBackgroundMusic,
  };
}

/**
 * Legacy: Initialize and return the singleton Supabase client.
 * Maps to SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for backwards compatibility.
 */
function getClient() {
  if (!legacyClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    legacyClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return legacyClient;
}

module.exports = {
  createEnvironmentClient,
  getClient,
};
