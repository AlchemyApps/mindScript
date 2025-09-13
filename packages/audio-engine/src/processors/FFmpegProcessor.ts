import ffmpeg from "fluent-ffmpeg";
import type { FfmpegCommand } from "fluent-ffmpeg";
import { Result, Ok, Err, AudioJob } from "../types";
import * as path from "path";
import { Readable, Writable } from "stream";

interface FFmpegConfig {
  ffmpegPath?: string;
  ffprobePath?: string;
}

interface ConvertOptions {
  bitrate?: string;
  sampleRate?: number;
}

interface MixInput {
  path: string;
  gainDb: number;
}

interface ToneOptions {
  frequency: number;
  durationSec: number;
  outputPath: string;
  waveform: "sine" | "triangle" | "square";
  gainDb?: number;
}

interface BinauralOptions {
  carrierHz: number;
  beatHz: number;
  durationSec: number;
  outputPath: string;
  gainDb?: number;
}

interface SilenceOptions {
  inputPath: string;
  outputPath: string;
  silenceDuration: number;
  position: "start" | "end";
}

interface FadeOptions {
  inputPath: string;
  outputPath: string;
  fadeInMs: number;
  fadeOutMs: number;
}

interface StreamOptions {
  format: "mp3" | "wav";
  enforeStereo: boolean;
  bitrate?: string;
}

/**
 * FFmpeg processor for audio manipulation with mandatory stereo enforcement.
 * All audio outputs are guaranteed to be stereo (2 channels).
 */
export class FFmpegProcessor {
  private ffmpegPath?: string;
  private ffprobePath?: string;

  constructor(config?: FFmpegConfig) {
    this.ffmpegPath = config?.ffmpegPath;
    this.ffprobePath = config?.ffprobePath;

    if (this.ffmpegPath) {
      ffmpeg.setFfmpegPath(this.ffmpegPath);
    }
    if (this.ffprobePath) {
      ffmpeg.setFfprobePath(this.ffprobePath);
    }
  }

  /**
   * Normalize audio loudness to target LUFS (broadcast standard).
   * Always outputs stereo audio.
   */
  async normalizeLoudness(
    inputPath: string,
    outputPath: string,
    targetLufs: number = -16
  ): Promise<Result<{ outputPath: string; targetLufs: number }>> {
    return new Promise((resolve) => {
      const command = ffmpeg(inputPath)
        .audioFilters([
          `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`,
          "aformat=channel_layouts=stereo", // Ensure stereo
        ])
        .audioChannels(2) // MANDATORY: Enforce stereo
        .outputOptions(["-ar", "44100"]) // Standard sample rate
        .output(outputPath)
        .on("end", () => {
          resolve(Ok({ outputPath, targetLufs }));
        })
        .on("error", (err) => {
          resolve(Err(new Error(`Loudness normalization failed: ${err.message}`)));
        });

      command.run();
    });
  }

  /**
   * Convert audio format with stereo enforcement.
   */
  async convertFormat(
    inputPath: string,
    outputPath: string,
    format: "mp3" | "wav",
    options?: ConvertOptions
  ): Promise<Result<{ outputPath: string; format: string }>> {
    return new Promise((resolve) => {
      const command = ffmpeg(inputPath)
        .audioChannels(2) // MANDATORY: Enforce stereo
        .audioFrequency(options?.sampleRate || 44100);

      if (format === "mp3") {
        command.audioCodec("libmp3lame");
        if (options?.bitrate) {
          command.audioBitrate(options.bitrate);
        } else {
          command.audioBitrate("192k"); // Default high quality
        }
      } else if (format === "wav") {
        command.audioCodec("pcm_s16le");
      }

      command
        .output(outputPath)
        .on("end", () => {
          resolve(Ok({ outputPath, format }));
        })
        .on("error", (err) => {
          resolve(Err(new Error(`Format conversion failed: ${err.message}`)));
        })
        .run();
    });
  }

  /**
   * Mix multiple audio tracks with individual gain control.
   * Always outputs stereo mix.
   */
  async mixAudioTracks(
    inputs: MixInput[],
    outputPath: string
  ): Promise<Result<{ outputPath: string; inputCount: number }>> {
    if (inputs.length === 0) {
      return Err(new Error("At least one input track required"));
    }

    return new Promise((resolve) => {
      const command = ffmpeg();

      // Add all inputs
      inputs.forEach((input) => {
        command.input(input.path);
      });

      // Build filter complex for mixing
      const filterInputs = inputs.map((_, i) => `[${i}:a]`).join("");
      const volumeFilters = inputs.map((input, i) => 
        `[${i}:a]volume=${this.dbToLinear(input.gainDb)}[a${i}]`
      ).join(";");
      const mixInputs = inputs.map((_, i) => `[a${i}]`).join("");
      
      const filterComplex = inputs.length > 1
        ? `${volumeFilters};${mixInputs}amix=inputs=${inputs.length}:duration=longest[mixed];[mixed]aformat=channel_layouts=stereo[out]`
        : `${volumeFilters};[a0]aformat=channel_layouts=stereo[out]`;

      command
        .complexFilter(filterComplex)
        .outputOptions(["-map", "[out]"])
        .audioChannels(2) // MANDATORY: Enforce stereo
        .output(outputPath)
        .on("end", () => {
          resolve(Ok({ outputPath, inputCount: inputs.length }));
        })
        .on("error", (err) => {
          resolve(Err(new Error(`Audio mixing failed: ${err.message}`)));
        })
        .run();
    });
  }

  /**
   * Generate a pure tone at specified frequency.
   * Always outputs stereo tone.
   */
  async generateTone(
    options: ToneOptions
  ): Promise<Result<{ outputPath: string; frequency: number; duration: number }>> {
    return new Promise((resolve) => {
      const { frequency, durationSec, outputPath, waveform, gainDb = 0 } = options;
      
      // Generate stereo tone by duplicating mono source
      const waveformGen = waveform === "sine" ? "sine" : 
                          waveform === "triangle" ? "tri" :
                          "square";

      const command = ffmpeg()
        .input(`sine=frequency=${frequency}:sample_rate=44100:duration=${durationSec}`)
        .inputOptions(["-f", "lavfi"])
        .audioFilters([
          `volume=${this.dbToLinear(gainDb)}`,
          "aformat=channel_layouts=stereo", // Convert to stereo
        ])
        .audioChannels(2) // MANDATORY: Enforce stereo
        .audioCodec("libmp3lame")
        .audioBitrate("192k")
        .output(outputPath)
        .on("end", () => {
          resolve(Ok({ 
            outputPath, 
            frequency, 
            duration: durationSec 
          }));
        })
        .on("error", (err) => {
          resolve(Err(new Error(`Tone generation failed: ${err.message}`)));
        });

      command.run();
    });
  }

  /**
   * Generate binaural beat with different frequencies for left/right channels.
   * Inherently stereo by design.
   */
  async generateBinauralBeat(
    options: BinauralOptions
  ): Promise<Result<{ outputPath: string; leftFreq: number; rightFreq: number }>> {
    return new Promise((resolve) => {
      const { carrierHz, beatHz, durationSec, outputPath, gainDb = 0 } = options;
      
      const leftFreq = carrierHz - beatHz / 2;
      const rightFreq = carrierHz + beatHz / 2;

      const command = ffmpeg()
        // Generate left channel
        .input(`sine=frequency=${leftFreq}:sample_rate=44100:duration=${durationSec}`)
        .inputOptions(["-f", "lavfi"])
        // Generate right channel
        .input(`sine=frequency=${rightFreq}:sample_rate=44100:duration=${durationSec}`)
        .inputOptions(["-f", "lavfi"])
        .complexFilter([
          `[0:a]volume=${this.dbToLinear(gainDb)}[left]`,
          `[1:a]volume=${this.dbToLinear(gainDb)}[right]`,
          "[left][right]amerge=inputs=2[out]",
        ])
        .outputOptions(["-map", "[out]"])
        .audioChannels(2) // MANDATORY: Already stereo, but enforce
        .audioCodec("libmp3lame")
        .audioBitrate("192k")
        .output(outputPath)
        .on("end", () => {
          resolve(Ok({ outputPath, leftFreq, rightFreq }));
        })
        .on("error", (err) => {
          resolve(Err(new Error(`Binaural beat generation failed: ${err.message}`)));
        });

      command.run();
    });
  }

  /**
   * Insert silence at start or end of audio.
   * Maintains stereo throughout.
   */
  async insertSilence(
    options: SilenceOptions
  ): Promise<Result<{ outputPath: string; silenceDuration: number; position: string }>> {
    return new Promise((resolve) => {
      const { inputPath, outputPath, silenceDuration, position } = options;

      const command = ffmpeg();

      if (position === "start") {
        // Generate stereo silence
        command
          .input(`anullsrc=channel_layout=stereo:sample_rate=44100:duration=${silenceDuration}`)
          .inputOptions(["-f", "lavfi"])
          .input(inputPath)
          .complexFilter([
            "[0:a][1:a]concat=n=2:v=0:a=1[out]",
          ]);
      } else {
        // position === "end"
        command
          .input(inputPath)
          .input(`anullsrc=channel_layout=stereo:sample_rate=44100:duration=${silenceDuration}`)
          .inputOptions(["-f", "lavfi"])
          .complexFilter([
            "[0:a][1:a]concat=n=2:v=0:a=1[out]",
          ]);
      }

      command
        .outputOptions(["-map", "[out]"])
        .audioChannels(2) // MANDATORY: Enforce stereo
        .output(outputPath)
        .on("end", () => {
          resolve(Ok({ outputPath, silenceDuration, position }));
        })
        .on("error", (err) => {
          resolve(Err(new Error(`Silence insertion failed: ${err.message}`)));
        });

      command.run();
    });
  }

  /**
   * Apply fade in/out effects.
   * Maintains stereo throughout.
   */
  async applyFade(
    options: FadeOptions
  ): Promise<Result<{ outputPath: string; fadeInMs: number; fadeOutMs: number }>> {
    return new Promise((resolve) => {
      const { inputPath, outputPath, fadeInMs, fadeOutMs } = options;

      // Get duration first for fade out calculation
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err || !metadata.format.duration) {
          resolve(Err(new Error(`Failed to get audio duration: ${err?.message}`)));
          return;
        }

        const duration = metadata.format.duration;
        const fadeInSec = fadeInMs / 1000;
        const fadeOutSec = fadeOutMs / 1000;
        const fadeOutStart = duration - fadeOutSec;

        const command = ffmpeg(inputPath)
          .audioFilters([
            `afade=t=in:st=0:d=${fadeInSec}`,
            `afade=t=out:st=${fadeOutStart}:d=${fadeOutSec}`,
            "aformat=channel_layouts=stereo", // Ensure stereo
          ])
          .audioChannels(2) // MANDATORY: Enforce stereo
          .output(outputPath)
          .on("end", () => {
            resolve(Ok({ outputPath, fadeInMs, fadeOutMs }));
          })
          .on("error", (err) => {
            resolve(Err(new Error(`Fade application failed: ${err.message}`)));
          });

        command.run();
      });
    });
  }

  /**
   * Process complete audio job with all layers.
   * Ensures stereo output at every stage.
   */
  async processAudioJob(
    job: AudioJob,
    outputPath: string
  ): Promise<Result<{ outputPath: string; format: string; channels: number }>> {
    try {
      const command = ffmpeg();
      const filters: string[] = [];
      let inputCount = 0;

      // Add voice input if provided
      if (job.voiceUrl) {
        command.input(job.voiceUrl);
        filters.push(`[${inputCount}:a]volume=${this.dbToLinear(job.gains.voiceDb)}[voice]`);
        inputCount++;
      }

      // Add music input if provided
      if (job.musicUrl) {
        command.input(job.musicUrl);
        filters.push(`[${inputCount}:a]volume=${this.dbToLinear(job.gains.musicDb)}[music]`);
        inputCount++;
      }

      // Generate Solfeggio tone if enabled
      if (job.solfeggio?.enabled) {
        const freq = job.solfeggio.hz;
        const wave = job.solfeggio.wave || "sine";
        command.input(`sine=frequency=${freq}:sample_rate=44100`)
          .inputOptions(["-f", "lavfi", "-t", `${job.durationMin * 60}`]);
        filters.push(`[${inputCount}:a]volume=${this.dbToLinear(job.gains.solfeggioDb)}[solfeggio]`);
        inputCount++;
      }

      // Generate binaural beat if enabled
      if (job.binaural?.enabled) {
        const leftFreq = job.binaural.carrierHz - job.binaural.beatHz / 2;
        const rightFreq = job.binaural.carrierHz + job.binaural.beatHz / 2;
        
        // Left channel
        command.input(`sine=frequency=${leftFreq}:sample_rate=44100`)
          .inputOptions(["-f", "lavfi", "-t", `${job.durationMin * 60}`]);
        // Right channel
        command.input(`sine=frequency=${rightFreq}:sample_rate=44100`)
          .inputOptions(["-f", "lavfi", "-t", `${job.durationMin * 60}`]);
        
        filters.push(`[${inputCount}:a]volume=${this.dbToLinear(job.gains.binauralDb)}[binLeft]`);
        filters.push(`[${inputCount + 1}:a]volume=${this.dbToLinear(job.gains.binauralDb)}[binRight]`);
        filters.push("[binLeft][binRight]amerge=inputs=2[binaural]");
        inputCount += 2;
      }

      // Mix all inputs
      const mixInputs: string[] = [];
      if (job.voiceUrl) mixInputs.push("[voice]");
      if (job.musicUrl) mixInputs.push("[music]");
      if (job.solfeggio?.enabled) mixInputs.push("[solfeggio]");
      if (job.binaural?.enabled) mixInputs.push("[binaural]");

      if (mixInputs.length > 0) {
        const mixFilter = mixInputs.length > 1
          ? `${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=longest[mixed]`
          : `${mixInputs[0]}anull[mixed]`; // Pass through single input

        filters.push(mixFilter);

        // Apply fade effects
        filters.push(`[mixed]afade=t=in:d=${(job.fade.inMs || 1000) / 1000}:curve=log[faded]`);
        
        // Apply loudness normalization if limiter enabled
        if (job.safety.limiter) {
          filters.push(`[faded]loudnorm=I=${job.safety.targetLufs}:TP=-1.5:LRA=11[normalized]`);
        } else {
          filters.push("[faded]anull[normalized]");
        }

        // MANDATORY: Ensure stereo output
        filters.push("[normalized]aformat=channel_layouts=stereo[out]");

        return new Promise((resolve) => {
          command
            .complexFilter(filters.join(";"))
            .outputOptions(["-map", "[out]"])
            .audioChannels(2) // MANDATORY: Enforce stereo
            .duration(job.durationMin * 60);

          if (job.outputFormat === "mp3") {
            command.audioCodec("libmp3lame").audioBitrate("192k");
          } else {
            command.audioCodec("pcm_s16le");
          }

          command
            .output(outputPath)
            .on("end", () => {
              resolve(Ok({ 
                outputPath, 
                format: job.outputFormat || "mp3",
                channels: 2 // Always stereo
              }));
            })
            .on("error", (err) => {
              resolve(Err(new Error(`Audio job processing failed: ${err.message}`)));
            })
            .run();
        });
      }

      return Err(new Error("No audio inputs provided"));
    } catch (error) {
      return Err(new Error(`Audio job processing failed: ${(error as Error).message}`));
    }
  }

  /**
   * Validate that audio file is stereo compliant.
   */
  async validateStereoCompliance(
    audioPath: string
  ): Promise<Result<{ isStereo: boolean; channels: number }>> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          resolve(Err(new Error(`Failed to analyze audio: ${err.message}`)));
          return;
        }

        const audioStream = metadata.streams.find(s => s.codec_type === "audio");
        if (!audioStream) {
          resolve(Err(new Error("No audio stream found")));
          return;
        }

        const channels = audioStream.channels || 0;
        resolve(Ok({
          isStereo: channels === 2,
          channels,
        }));
      });
    });
  }

  /**
   * Process audio stream with stereo enforcement.
   */
  async processStream(
    inputStream: Readable,
    outputStream: Writable,
    options: StreamOptions
  ): Promise<Result<void>> {
    return new Promise((resolve) => {
      const command = ffmpeg(inputStream)
        .audioChannels(2) // MANDATORY: Enforce stereo
        .audioFrequency(44100);

      if (options.format === "mp3") {
        command.audioCodec("libmp3lame");
        command.audioBitrate(options.bitrate || "192k");
      } else {
        command.audioCodec("pcm_s16le");
      }

      command
        .format(options.format)
        .pipe(outputStream, { end: true })
        .on("error", (err) => {
          resolve(Err(new Error(`Stream processing failed: ${err.message}`)));
        });

      outputStream.on("finish", () => {
        resolve(Ok(undefined));
      });
    });
  }

  /**
   * Convert decibels to linear scale for volume adjustment.
   */
  private dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }
}