import { FFmpegProcessor } from "./FFmpegProcessor";
import { GainController } from "./GainController";
import { TempFileManager } from "../utils/TempFileManager";
import { DEFAULT_GAINS, AUDIO_CONSTANTS } from "../constants";
import { Result, Ok, Err } from "../types";
import * as fs from "fs/promises";

interface MixLayersOptions {
  voicePath?: string;
  musicPath?: string;
  solfeggioPath?: string;
  binauralPath?: string;
  outputPath: string;
  gains?: {
    voiceDb?: number;
    musicDb?: number;
    solfeggioDb?: number;
    binauralDb?: number;
  };
  targetLufs?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  preventClipping?: boolean;
  autoGainStaging?: boolean;
}

interface MixLayersResult {
  outputPath: string;
  layerCount: number;
  layers: string[];
  gains: {
    voice?: number;
    music?: number;
    solfeggio?: number;
    binaural?: number;
  };
  targetLufs: number;
  normalized: boolean;
  fadeInMs?: number;
  fadeOutMs?: number;
  channels: number;
  isStereo: boolean;
  clippingPrevented?: boolean;
  autoGainApplied?: boolean;
  mixGainReduction?: number;
  peakLevel?: number;
}

interface CrossfadeOptions {
  fromPath: string;
  toPath: string;
  outputPath: string;
  crossfadeDurationMs: number;
}

interface CrossfadeResult {
  outputPath: string;
  crossfadeDurationMs: number;
}

/**
 * Multi-layer audio mixer with automatic gain staging and normalization.
 * Ensures stereo output and broadcast-standard loudness.
 */
export class AudioMixer {
  private ffmpeg: FFmpegProcessor;
  private gainController: GainController;
  private tempManager: TempFileManager;

  constructor() {
    this.ffmpeg = new FFmpegProcessor();
    this.gainController = new GainController();
    this.tempManager = new TempFileManager();
  }

  /**
   * Mix multiple audio layers with individual gain control.
   * Automatically normalizes to target LUFS for broadcast standard.
   */
  async mixLayers(options: MixLayersOptions): Promise<Result<MixLayersResult>> {
    const {
      voicePath,
      musicPath,
      solfeggioPath,
      binauralPath,
      outputPath,
      gains = {},
      targetLufs = AUDIO_CONSTANTS.TARGET_LUFS,
      fadeInMs,
      fadeOutMs,
      preventClipping = true,
      autoGainStaging = false,
    } = options;

    // Collect active layers
    const layers: Array<{ path: string; type: string; gainDb: number }> = [];
    const layerNames: string[] = [];
    const appliedGains: MixLayersResult["gains"] = {};

    if (voicePath) {
      const gainDb = gains.voiceDb ?? DEFAULT_GAINS.VOICE;
      layers.push({ path: voicePath, type: "voice", gainDb });
      layerNames.push("voice");
      appliedGains.voice = gainDb;
    }

    if (musicPath) {
      const gainDb = gains.musicDb ?? DEFAULT_GAINS.MUSIC;
      layers.push({ path: musicPath, type: "music", gainDb });
      layerNames.push("music");
      appliedGains.music = gainDb;
    }

    if (solfeggioPath) {
      const gainDb = gains.solfeggioDb ?? DEFAULT_GAINS.SOLFEGGIO;
      layers.push({ path: solfeggioPath, type: "solfeggio", gainDb });
      layerNames.push("solfeggio");
      appliedGains.solfeggio = gainDb;
    }

    if (binauralPath) {
      const gainDb = gains.binauralDb ?? DEFAULT_GAINS.BINAURAL;
      layers.push({ path: binauralPath, type: "binaural", gainDb });
      layerNames.push("binaural");
      appliedGains.binaural = gainDb;
    }

    // Validate we have at least one input
    if (layers.length === 0) {
      return Err(new Error("At least one audio layer required for mixing"));
    }

    try {
      let mixGainReduction = 0;
      
      // Calculate automatic gain reduction to prevent buildup
      if (autoGainStaging && layers.length > 1) {
        mixGainReduction = this.gainController.calculateMixGain(layers.length);
        // Apply gain reduction to all layers
        layers.forEach(layer => {
          layer.gainDb += mixGainReduction;
        });
      }

      // Create temp file for initial mix
      const mixedPath = await this.tempManager.createTempFile("wav");

      // Mix all layers
      const mixResult = await this.ffmpeg.mixAudioTracks(
        layers.map(l => ({ path: l.path, gainDb: l.gainDb })),
        mixedPath
      );

      if (!mixResult.isOk) {
        await this.cleanup([mixedPath]);
        return Err(mixResult.error);
      }

      let processedPath = mixedPath;

      // Apply fade effects if requested
      if (fadeInMs || fadeOutMs) {
        const fadedPath = await this.tempManager.createTempFile("wav");
        const fadeResult = await this.ffmpeg.applyFade({
          inputPath: processedPath,
          outputPath: fadedPath,
          fadeInMs: fadeInMs || 0,
          fadeOutMs: fadeOutMs || 0,
        });

        if (!fadeResult.isOk) {
          await this.cleanup([mixedPath, fadedPath]);
          return Err(fadeResult.error);
        }

        processedPath = fadedPath;
      }

      // Apply clipping prevention if requested
      let peakLevel: number | undefined;
      if (preventClipping) {
        const limitedPath = await this.tempManager.createTempFile("wav");
        const limitResult = await this.gainController.preventClipping({
          inputPath: processedPath,
          outputPath: limitedPath,
          thresholdDb: -0.1,
        });

        if (!limitResult.isOk) {
          await this.cleanup([mixedPath, processedPath, limitedPath]);
          return Err(limitResult.error);
        }

        peakLevel = limitResult.value.peakLevel;
        processedPath = limitedPath;
      }

      // Normalize to target LUFS
      const normalizeResult = await this.ffmpeg.normalizeLoudness(
        processedPath,
        outputPath,
        targetLufs
      );

      if (!normalizeResult.isOk) {
        await this.cleanup([mixedPath, processedPath]);
        return Err(normalizeResult.error);
      }

      // Validate stereo compliance
      const stereoResult = await this.ffmpeg.validateStereoCompliance(outputPath);
      if (!stereoResult.isOk) {
        await this.cleanup([mixedPath, processedPath, outputPath]);
        return Err(stereoResult.error);
      }

      if (!stereoResult.value.isStereo) {
        await this.cleanup([mixedPath, processedPath, outputPath]);
        return Err(new Error("Output must be stereo"));
      }

      // Clean up temp files
      await this.cleanup([mixedPath, processedPath].filter(p => p !== outputPath));

      return Ok({
        outputPath,
        layerCount: layers.length,
        layers: layerNames,
        gains: appliedGains,
        targetLufs,
        normalized: true,
        fadeInMs,
        fadeOutMs,
        channels: stereoResult.value.channels,
        isStereo: stereoResult.value.isStereo,
        clippingPrevented: preventClipping,
        autoGainApplied: autoGainStaging,
        mixGainReduction: autoGainStaging ? mixGainReduction : undefined,
        peakLevel,
      });
    } catch (error) {
      return Err(new Error(`Failed to mix audio layers: ${(error as Error).message}`));
    }
  }

  /**
   * Crossfade between two audio segments.
   */
  async crossfadeLayers(options: CrossfadeOptions): Promise<Result<CrossfadeResult>> {
    const { fromPath, toPath, outputPath, crossfadeDurationMs } = options;

    // Validate crossfade duration
    if (crossfadeDurationMs <= 0) {
      return Err(new Error("Crossfade duration must be positive"));
    }

    try {
      // Import ffmpeg dynamically
      const ffmpeg = (await import("fluent-ffmpeg")).default;
      
      // Get duration of first segment to ensure crossfade doesn't exceed it
      const probeResult = await new Promise<any>((resolve, reject) => {
        ffmpeg.ffprobe(fromPath, (err: Error, metadata: any) => {
          if (err) reject(err);
          else resolve(metadata);
        });
      });

      const fromDuration = probeResult.format.duration * 1000; // Convert to ms
      const actualCrossfade = Math.min(crossfadeDurationMs, fromDuration / 2);

      // Create crossfade using FFmpeg filter complex
      const command = ffmpeg();
      
      await new Promise<void>((resolve, reject) => {
        command
          .input(fromPath)
          .input(toPath)
          .complexFilter([
            `[0:a]afade=t=out:st=${(fromDuration - actualCrossfade) / 1000}:d=${actualCrossfade / 1000}[fadeout]`,
            `[1:a]afade=t=in:st=0:d=${actualCrossfade / 1000}[fadein]`,
            `[fadeout][fadein]amix=inputs=2:duration=longest[out]`,
          ])
          .outputOptions(["-map", "[out]"])
          .audioChannels(2) // Ensure stereo
          .output(outputPath)
          .on("end", () => resolve())
          .on("error", (err: Error) => reject(err))
          .run();
      });

      // Validate stereo compliance
      const stereoResult = await this.ffmpeg.validateStereoCompliance(outputPath);
      if (!stereoResult.isOk || !stereoResult.value.isStereo) {
        await this.cleanup([outputPath]);
        return Err(new Error("Crossfaded output must be stereo"));
      }

      return Ok({
        outputPath,
        crossfadeDurationMs: actualCrossfade,
      });
    } catch (error) {
      return Err(new Error(`Failed to crossfade layers: ${(error as Error).message}`));
    }
  }

  /**
   * Clean up temporary files.
   */
  private async cleanup(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}