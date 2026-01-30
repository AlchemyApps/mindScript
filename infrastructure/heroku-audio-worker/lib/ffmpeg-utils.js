/**
 * FFmpeg Utils Module
 * Audio generation and processing with carrier layer support for premium tone quality
 *
 * Enhancement: Solfeggio tones and binaural beats are embedded in a subtle carrier layer
 * (pink noise by default) for warmer, more natural sound instead of raw clinical sine waves.
 */

const ffmpeg = require('fluent-ffmpeg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Solfeggio frequencies with descriptions
 */
const SOLFEGGIO_FREQUENCIES = {
  174: { name: 'Ease & Grounding', description: 'Physical and mental easing' },
  285: { name: 'Reset & Restore', description: 'Gentle reset feeling' },
  396: { name: 'Release & Momentum', description: 'Letting go of guilt/fear' },
  417: { name: 'Change & Creativity', description: 'Transitions and fresh starts' },
  528: { name: 'Soothing Renewal', description: 'Popular feel-good tone' },
  639: { name: 'Connection & Communication', description: 'Empathy and clearer communication' },
  741: { name: 'Clear & Cleanse', description: 'Mental decluttering' },
  852: { name: 'Intuition & Clarity', description: 'Reflective, intuitive states' },
  963: { name: 'Spacious & Open', description: 'Expansive; quiet mind' },
};

/**
 * Binaural beat bands
 */
const BINAURAL_BANDS = {
  delta: { range: [1, 4], name: 'Deep Rest', defaultHz: 2 },
  theta: { range: [4, 8], name: 'Meditative Drift', defaultHz: 6 },
  alpha: { range: [8, 13], name: 'Relaxed Focus', defaultHz: 10 },
  beta: { range: [14, 30], name: 'Alert & Engaged', defaultHz: 20 },
  gamma: { range: [30, 100], name: 'Insight & Integration', defaultHz: 40 },
};

/**
 * Default gain levels in dB (from PRD gain staging)
 */
const DEFAULT_GAINS = {
  VOICE: -1,
  MUSIC: -10,
  SOLFEGGIO: -18,
  BINAURAL: -20,
  CARRIER: -24,
};

/**
 * Carrier types for premium tone quality
 */
const CARRIER_TYPES = {
  pink: 'anoisesrc=color=pink',
  brown: 'anoisesrc=color=brown',
  none: null,
};

/**
 * Verify FFmpeg is installed
 */
function verifyFFmpeg() {
  try {
    const version = execSync('ffmpeg -version').toString().split('\n')[0];
    console.log(`[FFmpeg] ${version}`);
    return true;
  } catch (error) {
    console.error('[FFmpeg] NOT FOUND - Worker cannot process audio');
    return false;
  }
}

/**
 * Convert dB to linear scale for volume adjustment
 */
function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

/**
 * Generate Solfeggio tone with optional carrier layer
 * Enhanced: Embeds the tone in a subtle pink noise carrier for warmer sound
 *
 * @param {object} options
 * @param {number} options.frequency - Solfeggio frequency (174, 285, 396, etc.)
 * @param {number} options.durationSec - Duration in seconds
 * @param {string} options.outputPath - Output file path
 * @param {number} options.gainDb - Tone gain in dB (default: -18)
 * @param {string} options.carrierType - 'pink', 'brown', or 'none' (default: 'pink')
 * @param {number} options.carrierGainDb - Carrier gain in dB (default: -24)
 */
async function generateSolfeggio(options) {
  const {
    frequency,
    durationSec,
    outputPath,
    gainDb = DEFAULT_GAINS.SOLFEGGIO,
    carrierType = 'pink',
    carrierGainDb = DEFAULT_GAINS.CARRIER,
  } = options;

  // Validate frequency
  if (!SOLFEGGIO_FREQUENCIES[frequency]) {
    throw new Error(`Invalid Solfeggio frequency: ${frequency}Hz. Valid: ${Object.keys(SOLFEGGIO_FREQUENCIES).join(', ')}`);
  }

  console.log(`[FFmpeg] Generating Solfeggio ${frequency}Hz (${durationSec}s) with ${carrierType} carrier`);

  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // Input 1: Solfeggio sine wave
    command.input(`sine=frequency=${frequency}:duration=${durationSec}:sample_rate=44100`);
    command.inputOptions(['-f', 'lavfi']);

    let filterComplex;

    if (carrierType !== 'none' && CARRIER_TYPES[carrierType]) {
      // Input 2: Carrier noise
      command.input(`${CARRIER_TYPES[carrierType]}:duration=${durationSec}:sample_rate=44100`);
      command.inputOptions(['-f', 'lavfi']);

      // Mix tone with carrier for premium quality
      // Tone is embedded in the carrier for warmth
      filterComplex = [
        `[0:a]volume=${dbToLinear(gainDb)}[tone]`,
        `[1:a]volume=${dbToLinear(carrierGainDb)}[carrier]`,
        '[tone][carrier]amix=inputs=2:duration=first[mixed]',
        '[mixed]aformat=channel_layouts=stereo[out]',
      ].join(';');
    } else {
      // No carrier - just the raw tone (clinical sound)
      filterComplex = [
        `[0:a]volume=${dbToLinear(gainDb)}[tone]`,
        '[tone]aformat=channel_layouts=stereo[out]',
      ].join(';');
    }

    command
      .complexFilter(filterComplex)
      .outputOptions(['-map', '[out]'])
      .audioChannels(2)
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputPath)
      .on('end', () => {
        console.log(`[FFmpeg] Solfeggio ${frequency}Hz generated: ${outputPath}`);
        resolve({
          outputPath,
          frequency,
          durationSec,
          carrierType,
          metadata: SOLFEGGIO_FREQUENCIES[frequency],
        });
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Solfeggio generation failed:`, err.message);
        reject(new Error(`Solfeggio generation failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Generate binaural beat with optional carrier layer
 * Enhanced: Embeds the L/R tones in a subtle pink noise carrier for warmer sound
 *
 * IMPORTANT: Binaural beats require stereo - left and right ears receive different frequencies
 * The perceived "beat" is the difference between L/R frequencies
 *
 * @param {object} options
 * @param {number} options.carrierHz - Base carrier frequency (100-1000 Hz)
 * @param {number} options.beatHz - Beat frequency (difference between L/R)
 * @param {number} options.durationSec - Duration in seconds
 * @param {string} options.outputPath - Output file path
 * @param {number} options.gainDb - Tone gain in dB (default: -20)
 * @param {string} options.noiseCarrierType - 'pink', 'brown', or 'none' (default: 'pink')
 * @param {number} options.noiseCarrierGainDb - Noise carrier gain in dB (default: -26)
 */
async function generateBinaural(options) {
  const {
    carrierHz = 200,
    beatHz = 10,
    durationSec,
    outputPath,
    gainDb = DEFAULT_GAINS.BINAURAL,
    noiseCarrierType = 'pink',
    noiseCarrierGainDb = -26,
  } = options;

  // Calculate left and right frequencies
  const leftFreq = carrierHz - beatHz / 2;
  const rightFreq = carrierHz + beatHz / 2;

  console.log(`[FFmpeg] Generating binaural: L=${leftFreq}Hz, R=${rightFreq}Hz, beat=${beatHz}Hz (${durationSec}s)`);

  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // Input 1: Left channel sine wave
    command.input(`sine=frequency=${leftFreq}:duration=${durationSec}:sample_rate=44100`);
    command.inputOptions(['-f', 'lavfi']);

    // Input 2: Right channel sine wave
    command.input(`sine=frequency=${rightFreq}:duration=${durationSec}:sample_rate=44100`);
    command.inputOptions(['-f', 'lavfi']);

    let filterComplex;

    if (noiseCarrierType !== 'none' && CARRIER_TYPES[noiseCarrierType]) {
      // Input 3: Noise carrier for warmth
      command.input(`${CARRIER_TYPES[noiseCarrierType]}:duration=${durationSec}:sample_rate=44100`);
      command.inputOptions(['-f', 'lavfi']);

      // Mix binaural tones with carrier
      // The carrier adds warmth while preserving L/R separation for binaural effect
      filterComplex = [
        `[0:a]volume=${dbToLinear(gainDb)}[left]`,
        `[1:a]volume=${dbToLinear(gainDb)}[right]`,
        '[left][right]amerge=inputs=2[binaural]',
        // Pan the noise to both channels equally
        `[2:a]volume=${dbToLinear(noiseCarrierGainDb)},pan=stereo|c0=c0|c1=c0[noise]`,
        '[binaural][noise]amix=inputs=2:duration=first[out]',
      ].join(';');
    } else {
      // No carrier - raw binaural tones
      filterComplex = [
        `[0:a]volume=${dbToLinear(gainDb)}[left]`,
        `[1:a]volume=${dbToLinear(gainDb)}[right]`,
        '[left][right]amerge=inputs=2[out]',
      ].join(';');
    }

    command
      .complexFilter(filterComplex)
      .outputOptions(['-map', '[out]'])
      .audioChannels(2)
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputPath)
      .on('end', () => {
        console.log(`[FFmpeg] Binaural beat generated: ${outputPath}`);
        resolve({
          outputPath,
          carrierHz,
          beatHz,
          leftFreq,
          rightFreq,
          durationSec,
          noiseCarrierType,
        });
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Binaural generation failed:`, err.message);
        reject(new Error(`Binaural generation failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Mix multiple audio tracks with individual gain control
 * @param {Array<{path: string, gainDb: number}>} inputs - Input tracks with gains
 * @param {string} outputPath - Output file path
 */
async function mixTracks(inputs, outputPath) {
  if (inputs.length === 0) {
    throw new Error('At least one input track required');
  }

  console.log(`[FFmpeg] Mixing ${inputs.length} tracks...`);

  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // Add all inputs
    inputs.forEach((input) => {
      command.input(input.path);
    });

    // Build filter complex
    const volumeFilters = inputs.map((input, i) =>
      `[${i}:a]volume=${dbToLinear(input.gainDb)}[a${i}]`
    );

    const mixInputs = inputs.map((_, i) => `[a${i}]`).join('');

    const filterComplex =
      inputs.length > 1
        ? `${volumeFilters.join(';')};${mixInputs}amix=inputs=${inputs.length}:duration=longest[mixed];[mixed]aformat=channel_layouts=stereo[out]`
        : `${volumeFilters.join(';')};[a0]aformat=channel_layouts=stereo[out]`;

    command
      .complexFilter(filterComplex)
      .outputOptions(['-map', '[out]'])
      .audioChannels(2)
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputPath)
      .on('end', () => {
        console.log(`[FFmpeg] Mix complete: ${outputPath}`);
        resolve({ outputPath, inputCount: inputs.length });
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Mix failed:`, err.message);
        reject(new Error(`Audio mixing failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Normalize audio loudness to target LUFS
 * @param {string} inputPath - Input file path
 * @param {string} outputPath - Output file path
 * @param {number} targetLufs - Target LUFS (default: -16)
 */
async function normalizeLoudness(inputPath, outputPath, targetLufs = -16) {
  console.log(`[FFmpeg] Normalizing to ${targetLufs} LUFS...`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters([
        `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`,
        'aformat=channel_layouts=stereo',
      ])
      .audioChannels(2)
      .audioFrequency(44100)
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputPath)
      .on('end', () => {
        console.log(`[FFmpeg] Normalization complete: ${outputPath}`);
        resolve({ outputPath, targetLufs });
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Normalization failed:`, err.message);
        reject(new Error(`Loudness normalization failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Apply fade in/out effects
 * @param {string} inputPath - Input file path
 * @param {string} outputPath - Output file path
 * @param {number} fadeInMs - Fade in duration in milliseconds
 * @param {number} fadeOutMs - Fade out duration in milliseconds
 */
async function applyFade(inputPath, outputPath, fadeInMs = 1000, fadeOutMs = 1500) {
  console.log(`[FFmpeg] Applying fade: in=${fadeInMs}ms, out=${fadeOutMs}ms`);

  return new Promise((resolve, reject) => {
    // First get duration
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err || !metadata.format.duration) {
        reject(new Error(`Failed to get audio duration: ${err?.message}`));
        return;
      }

      const duration = metadata.format.duration;
      const fadeInSec = fadeInMs / 1000;
      const fadeOutSec = fadeOutMs / 1000;
      const fadeOutStart = Math.max(0, duration - fadeOutSec);

      ffmpeg(inputPath)
        .audioFilters([
          `afade=t=in:st=0:d=${fadeInSec}`,
          `afade=t=out:st=${fadeOutStart}:d=${fadeOutSec}`,
          'aformat=channel_layouts=stereo',
        ])
        .audioChannels(2)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .output(outputPath)
        .on('end', () => {
          console.log(`[FFmpeg] Fade applied: ${outputPath}`);
          resolve({ outputPath, fadeInMs, fadeOutMs });
        })
        .on('error', (err) => {
          console.error(`[FFmpeg] Fade failed:`, err.message);
          reject(new Error(`Fade application failed: ${err.message}`));
        })
        .run();
    });
  });
}

/**
 * Get audio file duration in milliseconds
 * @param {string} filePath - Audio file path
 */
async function getDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to probe audio: ${err.message}`));
        return;
      }

      const durationMs = (metadata.format.duration || 0) * 1000;
      resolve(durationMs);
    });
  });
}

/**
 * Validate that audio file is stereo
 * @param {string} filePath - Audio file path
 */
async function validateStereo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to analyze audio: ${err.message}`));
        return;
      }

      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');
      if (!audioStream) {
        resolve({ isStereo: false, channels: 0 });
        return;
      }

      resolve({
        isStereo: audioStream.channels === 2,
        channels: audioStream.channels || 0,
      });
    });
  });
}

/**
 * Convert audio format
 * @param {string} inputPath - Input file path
 * @param {string} outputPath - Output file path
 * @param {string} format - Output format (mp3 or wav)
 */
async function convertFormat(inputPath, outputPath, format = 'mp3') {
  console.log(`[FFmpeg] Converting to ${format}...`);

  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .audioChannels(2)
      .audioFrequency(44100);

    if (format === 'mp3') {
      command.audioCodec('libmp3lame').audioBitrate('192k');
    } else if (format === 'wav') {
      command.audioCodec('pcm_s16le');
    }

    command
      .output(outputPath)
      .on('end', () => {
        console.log(`[FFmpeg] Conversion complete: ${outputPath}`);
        resolve({ outputPath, format });
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Conversion failed:`, err.message);
        reject(new Error(`Format conversion failed: ${err.message}`));
      })
      .run();
  });
}

module.exports = {
  verifyFFmpeg,
  generateSolfeggio,
  generateBinaural,
  mixTracks,
  normalizeLoudness,
  applyFade,
  getDuration,
  validateStereo,
  convertFormat,
  dbToLinear,
  SOLFEGGIO_FREQUENCIES,
  BINAURAL_BANDS,
  DEFAULT_GAINS,
  CARRIER_TYPES,
};
