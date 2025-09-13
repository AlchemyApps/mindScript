import { FFmpegProcessor } from "../processors/FFmpegProcessor";
import { TempFileManager } from "../utils/TempFileManager";
import { BINAURAL_BANDS, AUDIO_CONSTANTS } from "../constants";
import { Result, Ok, Err } from "../types";
import * as path from "path";
import * as fs from "fs/promises";

export type BinauralBand = keyof typeof BINAURAL_BANDS;

export interface BinauralBeatOptions {
  band: BinauralBand;
  beatFrequency: number;
  carrierFrequency: number;
  durationSec: number;
  outputPath: string;
  amplitude?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
}

export interface BinauralBeatResult {
  band: BinauralBand;
  beatFrequency: number;
  carrierFrequency: number;
  leftFreq: number;
  rightFreq: number;
  outputPath: string;
  amplitude?: number;
  durationSec: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  channels: number;
  isStereo: boolean;
}

export interface BinauralAllOptions {
  carrierFrequency: number;
  durationSec: number;
  outputDir: string;
  amplitude?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
}

export interface BinauralAllResult {
  bands: BinauralBand[];
  beatFrequencies: Record<BinauralBand, number>;
  outputPaths: string[];
}

export interface BinauralWithMetadata extends BinauralBeatResult {
  metadata: {
    name: string;
    description: string;
    band: BinauralBand;
    range: [number, number];
  };
}

/**
 * Generator for binaural beats.
 * Creates stereo audio with different frequencies in L/R channels to produce beat frequencies.
 * Stereo output is mandatory for binaural beats to work.
 */
export class BinauralGenerator {
  private ffmpeg: FFmpegProcessor;
  private tempManager: TempFileManager;
  private readonly defaultBeatFrequencies: Record<BinauralBand, number> = {
    delta: 2,
    theta: 6,
    alpha: 10,
    beta: 20,
    gamma: 40,
  };

  constructor() {
    this.ffmpeg = new FFmpegProcessor();
    this.tempManager = new TempFileManager();
  }

  /**
   * Generate a binaural beat for a specific band.
   * L/R channels will have different frequencies to create the beat.
   */
  async generateBeat(options: BinauralBeatOptions): Promise<Result<BinauralBeatResult>> {
    const { 
      band, 
      beatFrequency, 
      carrierFrequency, 
      durationSec, 
      outputPath, 
      amplitude = 0.5,
      fadeInMs,
      fadeOutMs 
    } = options;

    // Validate band and beat frequency
    const bandRange = BINAURAL_BANDS[band].range;
    if (beatFrequency < bandRange[0] || beatFrequency > bandRange[1]) {
      return Err(new Error(
        `Beat frequency ${beatFrequency}Hz is outside ${band} band range (${bandRange[0]}-${bandRange[1]}Hz)`
      ));
    }

    // Validate carrier frequency (typically 100-1000 Hz for best effect)
    if (carrierFrequency < 100 || carrierFrequency > 1000) {
      return Err(new Error("Carrier frequency must be between 100 and 1000 Hz for optimal binaural effect"));
    }

    // Validate amplitude
    if (amplitude !== undefined && (amplitude < 0 || amplitude > 1)) {
      return Err(new Error("Amplitude must be between 0 and 1"));
    }

    // Validate duration
    if (durationSec <= 0) {
      return Err(new Error("Duration must be positive"));
    }

    try {
      // Calculate left and right frequencies
      // Left ear gets lower frequency, right ear gets higher frequency
      const leftFreq = carrierFrequency - beatFrequency / 2;
      const rightFreq = carrierFrequency + beatFrequency / 2;

      // Convert amplitude to dB
      const gainDb = amplitude === 0 ? -60 : 20 * Math.log10(amplitude);

      // Generate binaural beat
      const binauralResult = await this.ffmpeg.generateBinauralBeat({
        carrierHz: carrierFrequency,
        beatHz: beatFrequency,
        durationSec,
        outputPath,
        gainDb,
      });

      if (!binauralResult.isOk) {
        return Err(binauralResult.error);
      }

      // Apply fade if requested
      if (fadeInMs || fadeOutMs) {
        const tempPath = await this.tempManager.createTempFile("wav");
        const fadeResult = await this.ffmpeg.applyFade({
          inputPath: outputPath,
          outputPath: tempPath,
          fadeInMs: fadeInMs || 0,
          fadeOutMs: fadeOutMs || 0,
        });

        if (!fadeResult.isOk) {
          await this.cleanup([tempPath]);
          return Err(fadeResult.error);
        }

        // Copy temp file content to output (don't use fs.rename as it might fail across file systems)
        try {
          await fs.copyFile(tempPath, outputPath);
          await fs.unlink(tempPath);
        } catch (error) {
          await this.cleanup([tempPath]);
          return Err(new Error(`Failed to copy faded file: ${(error as Error).message}`));
        }
      }

      // Validate stereo compliance - CRITICAL for binaural beats
      const stereoResult = await this.ffmpeg.validateStereoCompliance(outputPath);
      if (!stereoResult.isOk) {
        await this.cleanup([outputPath]);
        return Err(stereoResult.error);
      }

      if (!stereoResult.value.isStereo) {
        await this.cleanup([outputPath]);
        return Err(new Error("Binaural beat must be stereo - L/R channels must have different frequencies"));
      }

      return Ok({
        band,
        beatFrequency,
        carrierFrequency,
        leftFreq,
        rightFreq,
        outputPath,
        amplitude,
        durationSec,
        fadeInMs,
        fadeOutMs,
        channels: stereoResult.value.channels,
        isStereo: stereoResult.value.isStereo,
      });
    } catch (error) {
      return Err(new Error(`Failed to generate binaural beat: ${(error as Error).message}`));
    }
  }

  /**
   * Generate binaural beats for all 5 bands.
   */
  async generateAllBands(options: BinauralAllOptions): Promise<Result<BinauralAllResult>> {
    const { carrierFrequency, durationSec, outputDir, amplitude, fadeInMs, fadeOutMs } = options;
    const outputPaths: string[] = [];
    const generatedFiles: string[] = [];
    const bands: BinauralBand[] = ["delta", "theta", "alpha", "beta", "gamma"];

    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      for (const band of bands) {
        const beatFrequency = this.defaultBeatFrequencies[band];
        const outputPath = path.join(outputDir, `binaural-${band}.wav`);
        
        const result = await this.generateBeat({
          band,
          beatFrequency,
          carrierFrequency,
          durationSec,
          outputPath,
          amplitude,
          fadeInMs,
          fadeOutMs,
        });

        if (!result.isOk) {
          // Clean up any files we've already created
          await this.cleanup(generatedFiles);
          return Err(result.error);
        }

        outputPaths.push(outputPath);
        generatedFiles.push(outputPath);
      }

      return Ok({
        bands,
        beatFrequencies: this.defaultBeatFrequencies,
        outputPaths,
      });
    } catch (error) {
      await this.cleanup(generatedFiles);
      return Err(new Error(`Failed to generate all binaural bands: ${(error as Error).message}`));
    }
  }

  /**
   * Generate a binaural beat with metadata.
   */
  async generateWithMetadata(options: BinauralBeatOptions): Promise<Result<BinauralWithMetadata>> {
    const result = await this.generateBeat(options);
    
    if (!result.isOk) {
      return Err(result.error);
    }

    const metadata = BINAURAL_BANDS[options.band];
    
    if (!metadata) {
      return Err(new Error(`No metadata found for band ${options.band}`));
    }

    return Ok({
      ...result.value,
      metadata: {
        name: metadata.name,
        description: metadata.description,
        band: options.band,
        range: metadata.range,
      },
    });
  }

  /**
   * Calculate optimal carrier frequency for a given beat frequency.
   * Higher beat frequencies work better with higher carriers.
   */
  private calculateOptimalCarrier(beatFrequency: number): number {
    // Rule of thumb: carrier should be 20-50x the beat frequency
    // But stay within 200-500 Hz range for best effect
    const optimal = beatFrequency * 30;
    return Math.min(Math.max(optimal, 200), 500);
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