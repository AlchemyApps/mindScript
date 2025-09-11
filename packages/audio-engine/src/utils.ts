import { BINAURAL_BANDS, DEFAULT_GAINS, DEFAULT_FADES, AUDIO_CONSTANTS } from "./constants";
import type { AudioJob, ToneGenerator, ValidationResult } from "./types";

/**
 * Calculate binaural beat frequencies for left and right channels
 */
export function calculateBinauralFrequencies(
  band: keyof typeof BINAURAL_BANDS,
  beatHz?: number,
  carrierHz = 220
): { left: number; right: number; beatHz: number } {
  const bandInfo = BINAURAL_BANDS[band];
  const actualBeatHz = beatHz || (bandInfo.range[0] + bandInfo.range[1]) / 2;
  
  return {
    left: carrierHz - actualBeatHz / 2,
    right: carrierHz + actualBeatHz / 2,
    beatHz: actualBeatHz,
  };
}

/**
 * Convert decibels to linear amplitude
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear amplitude to decibels
 */
export function linearToDb(amplitude: number): number {
  return 20 * Math.log10(Math.max(0.0001, amplitude));
}

/**
 * Calculate total duration in seconds based on loop configuration
 */
export function calculateTotalDuration(
  baseDurationSec: number,
  durationMin: number,
  loopMode: "repeat" | "interval",
  pauseSec: number,
  intervalSec?: number
): number {
  const targetDurationSec = durationMin * 60;
  
  if (loopMode === "interval" && intervalSec) {
    const cyclesNeeded = Math.ceil(targetDurationSec / intervalSec);
    return cyclesNeeded * baseDurationSec + (cyclesNeeded - 1) * pauseSec;
  } else {
    // Repeat mode
    const cycleTime = baseDurationSec + pauseSec;
    const cyclesNeeded = Math.ceil(targetDurationSec / cycleTime);
    return cyclesNeeded * baseDurationSec + (cyclesNeeded - 1) * pauseSec;
  }
}

/**
 * Generate FFmpeg filter string for fade in/out
 */
export function generateFadeFilter(
  fadeInMs: number,
  fadeOutMs: number,
  durationSec: number
): string {
  const fadeInSec = fadeInMs / 1000;
  const fadeOutStart = durationSec - fadeOutMs / 1000;
  
  return `afade=t=in:st=0:d=${fadeInSec},afade=t=out:st=${fadeOutStart}:d=${fadeOutMs / 1000}`;
}

/**
 * Generate FFmpeg command for tone generation (solfeggio or binaural)
 */
export function generateToneCommand(generator: ToneGenerator, durationSec: number): string {
  const parts: string[] = [];
  
  if (generator.type === "solfeggio" && generator.frequency) {
    // Single sine wave for solfeggio
    parts.push(`sine=frequency=${generator.frequency}:duration=${durationSec}`);
  } else if (generator.type === "binaural" && generator.band) {
    // Two sine waves for binaural (left and right)
    const { left, right } = calculateBinauralFrequencies(
      generator.band,
      generator.beatHz,
      generator.carrierHz
    );
    
    // Generate stereo binaural beat
    parts.push(
      `sine=frequency=${left}:duration=${durationSec}[left]`,
      `sine=frequency=${right}:duration=${durationSec}[right]`,
      `[left][right]amerge=inputs=2`
    );
  }
  
  // Apply gain
  const linearGain = dbToLinear(generator.gainDb);
  parts.push(`volume=${linearGain}`);
  
  // Apply fades if specified
  if (generator.fadeIn || generator.fadeOut) {
    parts.push(
      generateFadeFilter(
        generator.fadeIn || 0,
        generator.fadeOut || 0,
        durationSec
      )
    );
  }
  
  return parts.join(",");
}

/**
 * Validate audio job configuration
 */
export function validateAudioJob(job: AudioJob): ValidationResult {
  const errors: { field: string; message: string; code: string }[] = [];
  const warnings: { field: string; message: string; suggestion?: string }[] = [];
  
  // Check duration limits
  const durationSec = job.durationMin * 60;
  if (durationSec < AUDIO_CONSTANTS.MIN_DURATION_SECONDS) {
    errors.push({
      field: "durationMin",
      message: `Duration must be at least ${AUDIO_CONSTANTS.MIN_DURATION_SECONDS / 60} minutes`,
      code: "DURATION_TOO_SHORT",
    });
  }
  
  if (durationSec > AUDIO_CONSTANTS.MAX_DURATION_SECONDS) {
    errors.push({
      field: "durationMin",
      message: `Duration cannot exceed ${AUDIO_CONSTANTS.MAX_DURATION_SECONDS / 60} minutes`,
      code: "DURATION_TOO_LONG",
    });
  }
  
  // Validate binaural requirements
  if (job.binaural?.enabled) {
    if (job.channels !== 2) {
      errors.push({
        field: "channels",
        message: "Binaural beats require stereo output (2 channels)",
        code: "BINAURAL_REQUIRES_STEREO",
      });
    }
    
    warnings.push({
      field: "binaural",
      message: "Binaural beats are most effective with headphones",
      suggestion: "Display headphones recommendation to user",
    });
  }
  
  // Check gain levels
  const gains = job.gains;
  if (gains.voiceDb < -30 || gains.voiceDb > 10) {
    warnings.push({
      field: "gains.voiceDb",
      message: `Voice gain ${gains.voiceDb}dB is outside recommended range`,
      suggestion: `Use ${DEFAULT_GAINS.VOICE}dB for optimal clarity`,
    });
  }
  
  // Validate pause time for repeat mode
  if (job.loopMode === "repeat" && (job.pauseSec < 1 || job.pauseSec > 30)) {
    errors.push({
      field: "pauseSec",
      message: "Pause must be between 1 and 30 seconds",
      code: "INVALID_PAUSE_DURATION",
    });
  }
  
  // Validate interval mode
  if (job.loopMode === "interval" && !job.intervalSec) {
    errors.push({
      field: "intervalSec",
      message: "Interval mode requires intervalSec to be specified",
      code: "MISSING_INTERVAL",
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Format duration from milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${seconds}s`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Estimate file size for rendered audio
 */
export function estimateFileSize(
  durationSec: number,
  format: "mp3" | "wav",
  bitrate = AUDIO_CONSTANTS.MP3_BITRATE
): number {
  if (format === "mp3") {
    // MP3: bitrate in kbps * duration in seconds / 8 = bytes
    return (bitrate * 1000 * durationSec) / 8;
  } else {
    // WAV: sample rate * bit depth * channels * duration
    const bytesPerSample = AUDIO_CONSTANTS.BIT_DEPTH / 8;
    return (
      AUDIO_CONSTANTS.SAMPLE_RATE *
      bytesPerSample *
      AUDIO_CONSTANTS.CHANNELS *
      durationSec
    );
  }
}

/**
 * Sanitize filename for output
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .substring(0, 100);
}