import { FFmpegProcessor } from "../processors/FFmpegProcessor";
import { TempFileManager } from "../utils/TempFileManager";
import { SOLFEGGIO_FREQUENCIES, DEFAULT_FADES, AUDIO_CONSTANTS } from "../constants";
import { Result, Ok, Err } from "../types";
import * as path from "path";
import * as fs from "fs/promises";

export interface SolfeggioOptions {
  frequency: number;
  durationSec: number;
  amplitude: number; // 0-1 range
  outputPath: string;
  fadeInMs?: number;
  fadeOutMs?: number;
}

export interface SolfeggioResult {
  frequency: number;
  outputPath: string;
  amplitude: number;
  durationSec: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  channels: number;
  isStereo: boolean;
}

export interface SolfeggioAllOptions {
  durationSec: number;
  amplitude: number;
  outputDir: string;
  fadeInMs?: number;
  fadeOutMs?: number;
}

export interface SolfeggioAllResult {
  frequencies: number[];
  outputPaths: string[];
  fadeInMs?: number;
  fadeOutMs?: number;
}

export interface SolfeggioWithMetadata extends SolfeggioResult {
  metadata: {
    name: string;
    description: string;
    frequency: number;
  };
}

/**
 * Generator for Solfeggio frequencies.
 * Creates pure sine wave tones at the 9 standard Solfeggio frequencies.
 * All outputs are guaranteed stereo.
 */
export class SolfeggioGenerator {
  private ffmpeg: FFmpegProcessor;
  private tempManager: TempFileManager;
  private readonly frequencies: number[];

  constructor() {
    this.ffmpeg = new FFmpegProcessor();
    this.tempManager = new TempFileManager();
    this.frequencies = Object.keys(SOLFEGGIO_FREQUENCIES).map(Number);
  }

  /**
   * Generate a single Solfeggio frequency tone.
   * Output is always stereo WAV format.
   */
  async generateFrequency(options: SolfeggioOptions): Promise<Result<SolfeggioResult>> {
    const { frequency, durationSec, amplitude, outputPath, fadeInMs, fadeOutMs } = options;

    // Validate frequency
    if (!this.validateFrequency(frequency)) {
      return Err(new Error(`Invalid Solfeggio frequency: ${frequency}Hz. Must be one of: ${this.frequencies.join(", ")}`));
    }

    // Validate amplitude
    if (amplitude < 0 || amplitude > 1) {
      return Err(new Error("Amplitude must be between 0 and 1"));
    }

    // Validate duration
    if (durationSec <= 0) {
      return Err(new Error("Duration must be positive"));
    }

    try {
      // Convert amplitude to dB (0.5 = -6dB, 1.0 = 0dB)
      const gainDb = amplitude === 0 ? -60 : 20 * Math.log10(amplitude);

      // Generate the tone
      const toneResult = await this.ffmpeg.generateTone({
        frequency,
        durationSec,
        outputPath,
        waveform: "sine",
        gainDb,
      });

      if (!toneResult.isOk) {
        return Err(toneResult.error);
      }

      let finalPath = outputPath;

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

      // Validate stereo compliance
      const stereoResult = await this.ffmpeg.validateStereoCompliance(outputPath);
      if (!stereoResult.isOk) {
        await this.cleanup([outputPath]);
        return Err(stereoResult.error);
      }

      if (!stereoResult.value.isStereo) {
        await this.cleanup([outputPath]);
        return Err(new Error("Generated tone is not stereo. Audio engine requires stereo output."));
      }

      return Ok({
        frequency,
        outputPath,
        amplitude,
        durationSec,
        fadeInMs,
        fadeOutMs,
        channels: stereoResult.value.channels,
        isStereo: stereoResult.value.isStereo,
      });
    } catch (error) {
      return Err(new Error(`Failed to generate Solfeggio frequency: ${(error as Error).message}`));
    }
  }

  /**
   * Generate all 9 Solfeggio frequencies.
   */
  async generateAll(options: SolfeggioAllOptions): Promise<Result<SolfeggioAllResult>> {
    const { durationSec, amplitude, outputDir, fadeInMs, fadeOutMs } = options;
    const outputPaths: string[] = [];
    const generatedFiles: string[] = [];

    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      for (const frequency of this.frequencies) {
        const outputPath = path.join(outputDir, `solfeggio-${frequency}Hz.wav`);
        
        const result = await this.generateFrequency({
          frequency,
          durationSec,
          amplitude,
          outputPath,
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
        frequencies: this.frequencies,
        outputPaths,
        fadeInMs,
        fadeOutMs,
      });
    } catch (error) {
      await this.cleanup(generatedFiles);
      return Err(new Error(`Failed to generate all Solfeggio frequencies: ${(error as Error).message}`));
    }
  }

  /**
   * Generate a Solfeggio frequency with metadata.
   */
  async generateWithMetadata(options: SolfeggioOptions): Promise<Result<SolfeggioWithMetadata>> {
    const result = await this.generateFrequency(options);
    
    if (!result.isOk) {
      return Err(result.error);
    }

    const metadata = SOLFEGGIO_FREQUENCIES[options.frequency as keyof typeof SOLFEGGIO_FREQUENCIES];
    
    if (!metadata) {
      return Err(new Error(`No metadata found for frequency ${options.frequency}Hz`));
    }

    return Ok({
      ...result.value,
      metadata: {
        name: metadata.name,
        description: metadata.description,
        frequency: options.frequency,
      },
    });
  }

  /**
   * Validate if a frequency is a valid Solfeggio frequency.
   */
  private validateFrequency(frequency: number): boolean {
    return this.frequencies.includes(frequency);
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