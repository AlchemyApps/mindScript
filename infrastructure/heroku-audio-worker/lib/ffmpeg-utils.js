/**
 * FFmpeg Utils Module
 * Audio generation and processing with carrier layer support for premium tone quality
 *
 * Enhancement: Solfeggio tones and binaural beats are embedded in a subtle carrier layer
 * (pink noise by default) for warmer, more natural sound instead of raw clinical sine waves.
 *
 * Note: Sine wave generation uses raw PCM instead of lavfi for broader FFmpeg compatibility.
 */

const ffmpeg = require('fluent-ffmpeg');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Generate a sine wave as raw PCM data and save to file
 * This avoids the need for lavfi which may not be available in all FFmpeg builds
 *
 * @param {number} frequency - Frequency in Hz
 * @param {number} durationSec - Duration in seconds
 * @param {number} sampleRate - Sample rate (default 44100)
 * @param {number} amplitude - Amplitude 0-1 (default 0.8)
 * @returns {Buffer} - Raw PCM buffer (16-bit signed, mono)
 */
function generateSineWaveBuffer(frequency, durationSec, sampleRate = 44100, amplitude = 0.8) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
    const intSample = Math.round(sample * 32767); // Convert to 16-bit signed
    buffer.writeInt16LE(intSample, i * 2);
  }

  return buffer;
}

/**
 * Generate stereo sine wave with different L/R frequencies (for binaural beats)
 * @param {number} leftFreq - Left channel frequency in Hz
 * @param {number} rightFreq - Right channel frequency in Hz
 * @param {number} durationSec - Duration in seconds
 * @param {number} sampleRate - Sample rate (default 44100)
 * @param {number} amplitude - Amplitude 0-1 (default 0.8)
 * @returns {Buffer} - Raw PCM buffer (16-bit signed, interleaved stereo)
 */
function generateBinauralBuffer(leftFreq, rightFreq, durationSec, sampleRate = 44100, amplitude = 0.8) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(numSamples * 4); // 16-bit stereo = 4 bytes per sample pair

  for (let i = 0; i < numSamples; i++) {
    const leftSample = Math.sin(2 * Math.PI * leftFreq * i / sampleRate) * amplitude;
    const rightSample = Math.sin(2 * Math.PI * rightFreq * i / sampleRate) * amplitude;

    const leftInt = Math.round(leftSample * 32767);
    const rightInt = Math.round(rightSample * 32767);

    buffer.writeInt16LE(leftInt, i * 4);
    buffer.writeInt16LE(rightInt, i * 4 + 2);
  }

  return buffer;
}

/**
 * Convert raw PCM buffer to MP3 using FFmpeg
 * @param {Buffer} pcmBuffer - Raw PCM data
 * @param {string} outputPath - Output MP3 path
 * @param {number} channels - 1 for mono, 2 for stereo
 * @param {number} sampleRate - Sample rate
 * @param {number} gainDb - Gain adjustment in dB
 */
async function pcmBufferToMp3(pcmBuffer, outputPath, channels = 1, sampleRate = 44100, gainDb = 0) {
  return new Promise((resolve, reject) => {
    const volumeFilter = gainDb !== 0 ? `-af volume=${dbToLinear(gainDb)}` : '';

    const args = [
      '-f', 's16le',
      '-ar', sampleRate.toString(),
      '-ac', channels.toString(),
      '-i', 'pipe:0',
      ...(volumeFilter ? ['-af', `volume=${dbToLinear(gainDb)}`] : []),
      '-acodec', 'libmp3lame',
      '-ab', '192k',
      '-y',
      outputPath,
    ];

    const ffmpegProc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    ffmpegProc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProc.on('close', (code) => {
      if (code === 0) {
        resolve({ outputPath });
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpegProc.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });

    // Write PCM data to stdin
    ffmpegProc.stdin.write(pcmBuffer);
    ffmpegProc.stdin.end();
  });
}

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
 * Generate Solfeggio tone
 * Uses programmatic sine wave generation (no lavfi dependency)
 *
 * @param {object} options
 * @param {number} options.frequency - Solfeggio frequency (174, 285, 396, etc.)
 * @param {number} options.durationSec - Duration in seconds
 * @param {string} options.outputPath - Output file path
 * @param {number} options.gainDb - Tone gain in dB (default: -18)
 * @param {string} options.carrierType - Ignored (kept for API compatibility)
 * @param {number} options.carrierGainDb - Ignored (kept for API compatibility)
 */
async function generateSolfeggio(options) {
  const {
    frequency,
    durationSec,
    outputPath,
    gainDb = DEFAULT_GAINS.SOLFEGGIO,
  } = options;

  // Validate frequency
  if (!SOLFEGGIO_FREQUENCIES[frequency]) {
    throw new Error(`Invalid Solfeggio frequency: ${frequency}Hz. Valid: ${Object.keys(SOLFEGGIO_FREQUENCIES).join(', ')}`);
  }

  console.log(`[FFmpeg] Generating Solfeggio ${frequency}Hz (${durationSec}s)`);

  try {
    // Generate mono sine wave buffer
    const amplitude = dbToLinear(gainDb);
    const pcmBuffer = generateSineWaveBuffer(frequency, durationSec, 44100, amplitude);

    // Convert to stereo MP3 (duplicate mono to both channels)
    await pcmBufferToMp3Stereo(pcmBuffer, outputPath, 44100);

    console.log(`[FFmpeg] Solfeggio ${frequency}Hz generated: ${outputPath}`);
    return {
      outputPath,
      frequency,
      durationSec,
      carrierType: 'none',
      metadata: SOLFEGGIO_FREQUENCIES[frequency],
    };
  } catch (err) {
    console.error(`[FFmpeg] Solfeggio generation failed:`, err.message);
    throw new Error(`Solfeggio generation failed: ${err.message}`);
  }
}

/**
 * Convert mono PCM buffer to stereo MP3 (duplicates mono to both channels)
 */
async function pcmBufferToMp3Stereo(monoBuffer, outputPath, sampleRate = 44100) {
  // Convert mono to stereo by duplicating samples
  const numSamples = monoBuffer.length / 2;
  const stereoBuffer = Buffer.alloc(numSamples * 4);

  for (let i = 0; i < numSamples; i++) {
    const sample = monoBuffer.readInt16LE(i * 2);
    stereoBuffer.writeInt16LE(sample, i * 4);     // Left
    stereoBuffer.writeInt16LE(sample, i * 4 + 2); // Right
  }

  return pcmBufferToMp3(stereoBuffer, outputPath, 2, sampleRate, 0);
}

/**
 * Generate binaural beat
 * Uses programmatic stereo sine wave generation (no lavfi dependency)
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
 * @param {string} options.noiseCarrierType - Ignored (kept for API compatibility)
 * @param {number} options.noiseCarrierGainDb - Ignored (kept for API compatibility)
 */
async function generateBinaural(options) {
  const {
    carrierHz = 200,
    beatHz = 10,
    durationSec,
    outputPath,
    gainDb = DEFAULT_GAINS.BINAURAL,
  } = options;

  // Calculate left and right frequencies
  const leftFreq = carrierHz - beatHz / 2;
  const rightFreq = carrierHz + beatHz / 2;

  console.log(`[FFmpeg] Generating binaural: L=${leftFreq}Hz, R=${rightFreq}Hz, beat=${beatHz}Hz (${durationSec}s)`);

  try {
    // Generate stereo binaural buffer with different L/R frequencies
    const amplitude = dbToLinear(gainDb);
    const stereoBuffer = generateBinauralBuffer(leftFreq, rightFreq, durationSec, 44100, amplitude);

    // Convert to MP3
    await pcmBufferToMp3(stereoBuffer, outputPath, 2, 44100, 0);

    console.log(`[FFmpeg] Binaural beat generated: ${outputPath}`);
    return {
      outputPath,
      carrierHz,
      beatHz,
      leftFreq,
      rightFreq,
      durationSec,
      noiseCarrierType: 'none',
    };
  } catch (err) {
    console.error(`[FFmpeg] Binaural generation failed:`, err.message);
    throw new Error(`Binaural generation failed: ${err.message}`);
  }
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
 * Generate a silence audio file
 * Uses /dev/zero as raw audio input (works on macOS/Linux without lavfi)
 * @param {number} durationSec - Duration in seconds
 * @param {string} outputPath - Output file path
 */
async function generateSilence(durationSec, outputPath) {
  console.log(`[FFmpeg] Generating ${durationSec}s silence: ${outputPath}`);

  return new Promise((resolve, reject) => {
    ffmpeg()
      // Read raw silence from /dev/zero (all zeros = silence)
      .input('/dev/zero')
      .inputOptions([
        '-f', 's16le',      // Raw 16-bit signed little-endian PCM
        '-ar', '44100',     // Sample rate
        '-ac', '2',         // Stereo
      ])
      .duration(durationSec)
      .audioChannels(2)
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputPath)
      .on('end', () => {
        console.log(`[FFmpeg] Silence generated: ${outputPath}`);
        resolve({ outputPath, durationSec });
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Silence generation failed:`, err.message);
        reject(new Error(`Silence generation failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Concatenate multiple audio files
 * @param {string[]} inputPaths - Array of input file paths
 * @param {string} outputPath - Output file path
 */
async function concatAudioFiles(inputPaths, outputPath) {
  if (inputPaths.length === 0) {
    throw new Error('At least one input file required for concatenation');
  }

  if (inputPaths.length === 1) {
    // Just copy the single file
    fs.copyFileSync(inputPaths[0], outputPath);
    return { outputPath, inputCount: 1 };
  }

  console.log(`[FFmpeg] Concatenating ${inputPaths.length} files...`);

  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // Add all inputs
    inputPaths.forEach((p) => {
      command.input(p);
    });

    // Build filter for concatenation
    const filterInputs = inputPaths.map((_, i) => `[${i}:a]`).join('');
    const filterComplex = `${filterInputs}concat=n=${inputPaths.length}:v=0:a=1[out]`;

    command
      .complexFilter(filterComplex)
      .outputOptions(['-map', '[out]'])
      .audioChannels(2)
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputPath)
      .on('end', () => {
        console.log(`[FFmpeg] Concat complete: ${outputPath}`);
        resolve({ outputPath, inputCount: inputPaths.length });
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Concat failed:`, err.message);
        reject(new Error(`Audio concatenation failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Loop voice track with pauses to fill target duration
 * PRD requirement: "Repeat base script; pause 1–30s between repetitions"
 *
 * @param {object} options
 * @param {string} options.voicePath - Path to the TTS voice file
 * @param {number} options.targetDurationSec - Target total duration in seconds
 * @param {number} options.pauseSec - Pause between loops in seconds (default: 5)
 * @param {string} options.outputPath - Output file path
 * @param {string} options.tempDir - Temp directory for intermediate files
 */
async function loopVoiceTrack(options) {
  const {
    voicePath,
    targetDurationSec,
    pauseSec = 5,
    outputPath,
    tempDir,
  } = options;

  // Get voice duration
  const voiceDurationMs = await getDuration(voicePath);
  const voiceDurationSec = voiceDurationMs / 1000;

  console.log(`[FFmpeg] Voice looping: voice=${voiceDurationSec.toFixed(1)}s, target=${targetDurationSec}s, pause=${pauseSec}s`);

  // If voice is already longer than target, just trim it
  if (voiceDurationSec >= targetDurationSec) {
    console.log(`[FFmpeg] Voice already >= target duration, trimming to ${targetDurationSec}s`);
    return trimAudio(voicePath, outputPath, targetDurationSec);
  }

  // Calculate how many loops we need
  const cycleLength = voiceDurationSec + pauseSec;
  const loopCount = Math.ceil(targetDurationSec / cycleLength);

  console.log(`[FFmpeg] Will create ${loopCount} loops (cycle=${cycleLength.toFixed(1)}s)`);

  // Generate silence file for the pause
  const silencePath = path.join(tempDir, 'loop_silence.mp3');
  await generateSilence(pauseSec, silencePath);

  // Build list of files to concatenate: voice, silence, voice, silence, ...
  const filesToConcat = [];
  for (let i = 0; i < loopCount; i++) {
    filesToConcat.push(voicePath);
    // Add silence after each voice except potentially the last
    if (i < loopCount - 1 || (loopCount * cycleLength) < targetDurationSec + pauseSec) {
      filesToConcat.push(silencePath);
    }
  }

  // Concatenate all segments
  const loopedPath = path.join(tempDir, 'voice_looped_raw.mp3');
  await concatAudioFiles(filesToConcat, loopedPath);

  // Trim to exact target duration
  await trimAudio(loopedPath, outputPath, targetDurationSec);

  // Cleanup intermediate file
  try {
    fs.unlinkSync(loopedPath);
    fs.unlinkSync(silencePath);
  } catch (e) {
    // Ignore cleanup errors
  }

  const finalDuration = await getDuration(outputPath);
  console.log(`[FFmpeg] Voice looping complete: ${(finalDuration / 1000).toFixed(1)}s`);

  return {
    outputPath,
    originalDurationSec: voiceDurationSec,
    loopCount,
    finalDurationSec: finalDuration / 1000,
  };
}

/**
 * Trim audio to a specific duration
 * @param {string} inputPath - Input file path
 * @param {string} outputPath - Output file path
 * @param {number} durationSec - Target duration in seconds
 */
async function trimAudio(inputPath, outputPath, durationSec) {
  console.log(`[FFmpeg] Trimming to ${durationSec}s: ${inputPath}`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .duration(durationSec)
      .audioChannels(2)
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputPath)
      .on('end', () => {
        console.log(`[FFmpeg] Trim complete: ${outputPath}`);
        resolve({ outputPath, durationSec });
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Trim failed:`, err.message);
        reject(new Error(`Audio trim failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Prepare background music to match target duration
 * - If music is shorter: loop with crossfade for seamless transition
 * - If music is longer: trim to target duration
 * - Always applies fade in at start, fade out at end
 *
 * @param {object} options
 * @param {string} options.inputPath - Path to the music file
 * @param {number} options.targetDurationSec - Target duration in seconds
 * @param {string} options.outputPath - Output file path
 * @param {number} options.fadeInSec - Fade in duration (default: 1)
 * @param {number} options.fadeOutSec - Fade out duration (default: 1.5)
 * @param {number} options.crossfadeSec - Crossfade duration for loops (default: 2)
 */
async function prepareBackgroundMusic(options) {
  const {
    inputPath,
    targetDurationSec,
    outputPath,
    fadeInSec = 1,
    fadeOutSec = 1.5,
    crossfadeSec = 2,
  } = options;

  // Get music duration
  const musicDurationMs = await getDuration(inputPath);
  const musicDurationSec = musicDurationMs / 1000;

  console.log(`[FFmpeg] Preparing music: source=${musicDurationSec.toFixed(1)}s, target=${targetDurationSec}s`);

  // Calculate fade out start time
  const fadeOutStart = Math.max(0, targetDurationSec - fadeOutSec);

  if (musicDurationSec >= targetDurationSec) {
    // Music is longer or equal - just trim and apply fades
    console.log(`[FFmpeg] Music >= target, trimming with fades`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .duration(targetDurationSec)
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
          console.log(`[FFmpeg] Music prepared (trimmed): ${outputPath}`);
          resolve({
            outputPath,
            originalDurationSec: musicDurationSec,
            finalDurationSec: targetDurationSec,
            looped: false,
          });
        })
        .on('error', (err) => {
          console.error(`[FFmpeg] Music prep failed:`, err.message);
          reject(new Error(`Music preparation failed: ${err.message}`));
        })
        .run();
    });
  }

  // Music is shorter - use stream_loop to loop it seamlessly
  console.log(`[FFmpeg] Music < target, looping with fades`);

  return new Promise((resolve, reject) => {
    ffmpeg()
      // Use stream_loop to loop the input indefinitely
      .input(inputPath)
      .inputOptions(['-stream_loop', '-1'])
      .duration(targetDurationSec)
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
        console.log(`[FFmpeg] Music prepared (looped): ${outputPath}`);
        resolve({
          outputPath,
          originalDurationSec: musicDurationSec,
          finalDurationSec: targetDurationSec,
          looped: true,
          loopCount: Math.ceil(targetDurationSec / musicDurationSec),
        });
      })
      .on('error', (err) => {
        console.error(`[FFmpeg] Music loop failed:`, err.message);
        reject(new Error(`Music looping failed: ${err.message}`));
      })
      .run();
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
  generateSilence,
  concatAudioFiles,
  loopVoiceTrack,
  trimAudio,
  prepareBackgroundMusic,
  SOLFEGGIO_FREQUENCIES,
  BINAURAL_BANDS,
  DEFAULT_GAINS,
  CARRIER_TYPES,
};
