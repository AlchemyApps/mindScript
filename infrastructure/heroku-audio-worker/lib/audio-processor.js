/**
 * Audio Processor Module
 * Orchestrates the full audio job processing pipeline:
 * 1. Generate TTS voice track
 * 2. Download background music (if any)
 * 3. Generate Solfeggio tone (if enabled)
 * 4. Generate binaural beat (if enabled)
 * 5. Mix all layers
 * 6. Apply fades and normalization
 * 7. Upload to Supabase Storage
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  verifyFFmpeg,
  generateSolfeggio,
  generateBinaural,
  mixTracks,
  normalizeLoudness,
  applyFade,
  getDuration,
  convertFormat,
  loopVoiceTrack,
  prepareBackgroundMusic,
  DEFAULT_GAINS,
  BINAURAL_BANDS,
} = require('./ffmpeg-utils');

const { synthesize } = require('./tts-client');
const {
  updateJobProgress,
  completeJob,
  uploadRenderedAudio,
  updateTrackAudio,
  downloadBackgroundMusic,
} = require('./supabase-client');

/**
 * Create a temporary directory for job processing
 */
function createTempDir(jobId) {
  const tempDir = path.join(os.tmpdir(), 'mindscript-audio', jobId);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up temporary directory
 */
function cleanupTempDir(tempDir) {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn(`[Cleanup] Failed to remove temp dir: ${tempDir}`, err.message);
  }
}

/**
 * Process a single audio job
 * @param {object} job - Job data from audio_job_queue
 * @param {object} supabase - Supabase client (optional, for legacy support)
 */
async function processAudioJob(job) {
  const jobId = job.job_id;
  const trackId = job.track_id;
  const payload = job.payload;

  console.log(`\n[Job ${jobId}] Starting processing for track ${trackId}`);
  console.log(`[Job ${jobId}] Raw payload:`, JSON.stringify(payload, null, 2));

  // Detailed config logging for debugging variable flow
  console.log(`[Job ${jobId}] Parsed config:`, {
    hasScript: !!(payload.script && payload.script.length > 0),
    scriptLength: payload.script?.length || 0,
    voice: {
      provider: payload.voice?.provider,
      id: payload.voice?.id || payload.voice?.voice_id,
    },
    durationMin: payload.durationMin ?? payload.duration,
    pauseSec: payload.pauseSec ?? payload.loop?.pause_seconds,
    loopMode: payload.loopMode ?? payload.loop?.enabled,
    backgroundMusic: payload.backgroundMusic ? {
      id: payload.backgroundMusic.id,
      hasUrl: !!payload.backgroundMusic.url,
    } : null,
    solfeggio: payload.solfeggio ? {
      enabled: payload.solfeggio.enabled,
      hz: payload.solfeggio.hz || payload.solfeggio.frequency,
      volumeDb: payload.solfeggio.volume_db,
    } : null,
    binaural: payload.binaural ? {
      enabled: payload.binaural.enabled,
      band: payload.binaural.band,
      beatHz: payload.binaural.beatHz,
      carrierHz: payload.binaural.carrierHz,
      volumeDb: payload.binaural.volume_db,
    } : null,
    gains: {
      voiceDb: payload.gains?.voiceDb,
      musicDb: payload.gains?.musicDb,
      solfeggioDb: payload.gains?.solfeggioDb,
      binauralDb: payload.gains?.binauralDb,
    },
  });

  // Create temp directory for this job
  const tempDir = createTempDir(jobId);
  console.log(`[Job ${jobId}] Temp directory: ${tempDir}`);

  // Calculate target duration (used by all layers)
  const durationSec = (payload.durationMin || payload.duration || 5) * 60;
  console.log(`[Job ${jobId}] Target duration: ${durationSec}s (${durationSec / 60} minutes)`);

  try {
    // Stage 1: Generate TTS voice (20%)
    await updateJobProgress(jobId, 5, 'Generating voice...');

    let voicePath = null;
    if (payload.script && payload.voice) {
      console.log(`[Job ${jobId}] Generating TTS...`);
      const voiceRawPath = path.join(tempDir, 'voice_raw.mp3');

      await synthesize(payload.script, {
        provider: payload.voice.provider || 'openai',
        voice: payload.voice.id || 'nova',
        model: payload.voice.model || 'tts-1',
        speed: payload.voice.speed || 1.0,
        voiceId: payload.voice.id, // For ElevenLabs
      }, voiceRawPath);

      console.log(`[Job ${jobId}] TTS complete: ${voiceRawPath}`);

      // Loop voice to fill target duration with pauses between repetitions
      // PRD: "Repeat base script; pause 1–30s between repetitions"
      const pauseSec = payload.pauseSec ?? payload.loop?.pause_seconds ?? 5;
      voicePath = path.join(tempDir, 'voice.mp3');

      await loopVoiceTrack({
        voicePath: voiceRawPath,
        targetDurationSec: durationSec,
        pauseSec,
        outputPath: voicePath,
        tempDir,
      });

      console.log(`[Job ${jobId}] Voice looped to ${durationSec}s with ${pauseSec}s pauses`);
    }
    await updateJobProgress(jobId, 20, 'Voice generated');

    // Stage 2: Download and prepare background music (30%)
    await updateJobProgress(jobId, 25, 'Preparing background music...');

    let musicPath = null;
    if (payload.backgroundMusic?.url) {
      console.log(`[Job ${jobId}] Downloading background music...`);
      const musicRawPath = path.join(tempDir, 'music_raw.mp3');

      const downloaded = await downloadBackgroundMusic(payload.backgroundMusic.url, musicRawPath);
      if (!downloaded) {
        console.warn(`[Job ${jobId}] Failed to download music, continuing without it`);
      } else {
        // Prepare music: loop/trim to match target duration with fades
        musicPath = path.join(tempDir, 'music.mp3');

        await prepareBackgroundMusic({
          inputPath: musicRawPath,
          targetDurationSec: durationSec,
          outputPath: musicPath,
          fadeInSec: 1,
          fadeOutSec: 1.5,
        });

        console.log(`[Job ${jobId}] Background music prepared for ${durationSec}s duration`);
      }
    }
    await updateJobProgress(jobId, 30, 'Background music ready');

    // Stage 3: Generate Solfeggio tone (40%)
    await updateJobProgress(jobId, 35, 'Generating Solfeggio tone...');

    let solfeggioPath = null;
    if (payload.solfeggio?.enabled && payload.solfeggio?.hz) {
      console.log(`[Job ${jobId}] Generating Solfeggio ${payload.solfeggio.hz}Hz...`);
      solfeggioPath = path.join(tempDir, 'solfeggio.mp3');

      await generateSolfeggio({
        frequency: payload.solfeggio.hz,
        durationSec,
        outputPath: solfeggioPath,
        gainDb: payload.gains?.solfeggioDb || DEFAULT_GAINS.SOLFEGGIO,
        carrierType: payload.carrierType || 'pink',
        carrierGainDb: payload.carrierGainDb || DEFAULT_GAINS.CARRIER,
      });
    }
    await updateJobProgress(jobId, 40, 'Solfeggio generated');

    // Stage 4: Generate binaural beat (50%)
    await updateJobProgress(jobId, 45, 'Generating binaural beats...');

    let binauralPath = null;
    if (payload.binaural?.enabled) {
      // Convert band name to beat frequency if needed
      let carrierHz = payload.binaural.carrierHz || 200;
      let beatHz = payload.binaural.beatHz;

      // If beatHz not provided but band name is, look up from BINAURAL_BANDS
      if (!beatHz && payload.binaural.band) {
        const bandInfo = BINAURAL_BANDS[payload.binaural.band];
        if (bandInfo) {
          beatHz = bandInfo.defaultHz;
          console.log(`[Job ${jobId}] Converted band "${payload.binaural.band}" to beatHz=${beatHz}`);
        } else {
          console.warn(`[Job ${jobId}] Unknown binaural band "${payload.binaural.band}", using default 10Hz`);
        }
      }
      beatHz = beatHz || 10; // Final fallback

      console.log(`[Job ${jobId}] Generating binaural beat: carrier=${carrierHz}Hz, beat=${beatHz}Hz`);
      binauralPath = path.join(tempDir, 'binaural.mp3');

      await generateBinaural({
        carrierHz,
        beatHz,
        durationSec,
        outputPath: binauralPath,
        gainDb: payload.gains?.binauralDb || DEFAULT_GAINS.BINAURAL,
        noiseCarrierType: payload.carrierType || 'pink',
        noiseCarrierGainDb: (payload.carrierGainDb || DEFAULT_GAINS.CARRIER) - 2, // Slightly lower for binaural
      });
    }
    await updateJobProgress(jobId, 50, 'Binaural generated');

    // Stage 5: Mix all layers (70%)
    await updateJobProgress(jobId, 55, 'Mixing audio layers...');

    const layers = [];

    if (voicePath && fs.existsSync(voicePath)) {
      layers.push({
        path: voicePath,
        gainDb: payload.gains?.voiceDb || DEFAULT_GAINS.VOICE,
      });
    }

    if (musicPath && fs.existsSync(musicPath)) {
      layers.push({
        path: musicPath,
        gainDb: payload.gains?.musicDb || DEFAULT_GAINS.MUSIC,
      });
    }

    if (solfeggioPath && fs.existsSync(solfeggioPath)) {
      layers.push({
        path: solfeggioPath,
        gainDb: 0, // Already gain-adjusted in generation
      });
    }

    if (binauralPath && fs.existsSync(binauralPath)) {
      layers.push({
        path: binauralPath,
        gainDb: 0, // Already gain-adjusted in generation
      });
    }

    if (layers.length === 0) {
      throw new Error('No audio layers to mix');
    }

    console.log(`[Job ${jobId}] Mixing ${layers.length} layers...`);
    const mixedPath = path.join(tempDir, 'mixed.mp3');
    await mixTracks(layers, mixedPath);
    await updateJobProgress(jobId, 70, 'Layers mixed');

    // Stage 6: Apply fades (80%)
    await updateJobProgress(jobId, 75, 'Applying fades...');

    const fadedPath = path.join(tempDir, 'faded.mp3');
    await applyFade(
      mixedPath,
      fadedPath,
      payload.fade?.inMs || 1000,
      payload.fade?.outMs || 1500
    );
    await updateJobProgress(jobId, 80, 'Fades applied');

    // Stage 7: Normalize loudness (90%)
    await updateJobProgress(jobId, 85, 'Normalizing loudness...');

    const outputPath = path.join(tempDir, 'output.mp3');
    await normalizeLoudness(
      fadedPath,
      outputPath,
      payload.safety?.targetLufs || -16
    );
    await updateJobProgress(jobId, 90, 'Loudness normalized');

    // Stage 8: Upload to storage (100%)
    await updateJobProgress(jobId, 95, 'Uploading to storage...');

    console.log(`[Job ${jobId}] Uploading to Supabase Storage...`);
    const uploadResult = await uploadRenderedAudio(outputPath, trackId, 'mp3');

    if (!uploadResult) {
      throw new Error('Failed to upload rendered audio to storage');
    }

    console.log(`[Job ${jobId}] Upload complete: audio-renders/${uploadResult.path}`);

    // Get final duration
    const durationMs = await getDuration(outputPath);
    console.log(`[Job ${jobId}] Final duration: ${Math.round(durationMs / 1000)}s`);

    // Update track with storage path (not signed URL) so the web app can re-sign on demand
    const storagePath = 'audio-renders/' + uploadResult.path;
    await updateTrackAudio(trackId, storagePath, durationMs);

    // Mark job as complete
    await completeJob(jobId, {
      audioUrl: uploadResult.url,
      storagePath: uploadResult.path,
      durationMs,
      layers: layers.length,
      format: 'mp3',
    });

    console.log(`[Job ${jobId}] Processing complete!`);

    // Cleanup
    cleanupTempDir(tempDir);

    return {
      success: true,
      audioUrl: uploadResult.url,
      durationMs,
    };

  } catch (error) {
    console.error(`[Job ${jobId}] Processing failed:`, error.message);

    // Mark job as failed
    await completeJob(jobId, null, error.message);

    // Cleanup
    cleanupTempDir(tempDir);

    throw error;
  }
}

/**
 * Validate job payload
 */
function validateJobPayload(payload) {
  const errors = [];

  // At least one audio source required
  const hasVoice = payload.script && payload.script.length > 0;
  const hasMusic = payload.backgroundMusic?.url;
  const hasSolfeggio = payload.solfeggio?.enabled;
  const hasBinaural = payload.binaural?.enabled;

  if (!hasVoice && !hasMusic && !hasSolfeggio && !hasBinaural) {
    errors.push('At least one audio source required (voice, music, solfeggio, or binaural)');
  }

  // Validate duration
  if (payload.durationMin && (payload.durationMin < 1 || payload.durationMin > 30)) {
    errors.push('Duration must be between 1 and 30 minutes');
  }

  // Validate Solfeggio frequency
  if (payload.solfeggio?.enabled && payload.solfeggio?.hz) {
    const validFreqs = [174, 285, 396, 417, 528, 639, 741, 852, 963];
    if (!validFreqs.includes(payload.solfeggio.hz)) {
      errors.push(`Invalid Solfeggio frequency: ${payload.solfeggio.hz}`);
    }
  }

  // Validate binaural beat
  if (payload.binaural?.enabled) {
    if (payload.binaural.carrierHz && (payload.binaural.carrierHz < 100 || payload.binaural.carrierHz > 1000)) {
      errors.push('Binaural carrier frequency must be between 100-1000 Hz');
    }
    if (payload.binaural.beatHz && (payload.binaural.beatHz < 1 || payload.binaural.beatHz > 100)) {
      errors.push('Binaural beat frequency must be between 1-100 Hz');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  processAudioJob,
  validateJobPayload,
  createTempDir,
  cleanupTempDir,
};
