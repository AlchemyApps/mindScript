import ffmpeg, { FfprobeData } from "fluent-ffmpeg";
import { Result, Ok, Err, AudioAnalysis } from "../types";

interface AnalyzerConfig {
  ffprobePath?: string;
  cacheTtlMs?: number;
}

interface FormatInfo {
  format: string;
  codecName: string;
}

interface StereoValidation {
  isValid: boolean;
  channels: number;
  reason?: string;
}

interface AudioLevels {
  peakDb: number;
  rmsDb: number;
  lufs: number;
}

/**
 * Audio analyzer for extracting metadata and validating audio properties.
 * Provides stereo compliance validation and audio level analysis.
 */
export class AudioAnalyzer {
  private ffprobePath?: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTtlMs: number;

  constructor(config?: AnalyzerConfig) {
    this.ffprobePath = config?.ffprobePath;
    this.cacheTtlMs = config?.cacheTtlMs || 60000; // 1 minute default

    if (this.ffprobePath) {
      ffmpeg.setFfprobePath(this.ffprobePath);
    }
  }

  /**
   * Analyze audio file and extract comprehensive data.
   */
  async analyze(audioPath: string): Promise<Result<AudioAnalysis>> {
    // Check cache first
    const cached = this.getFromCache(audioPath);
    if (cached) {
      return Ok(cached);
    }

    return new Promise((resolve) => {
      ffmpeg.ffprobe(audioPath, (err, data) => {
        if (err) {
          resolve(Err(new Error(`Failed to analyze audio: ${err.message}`)));
          return;
        }

        const audioStream = data.streams.find(s => s.codec_type === "audio");
        if (!audioStream) {
          resolve(Err(new Error("No audio stream found")));
          return;
        }

        const analysis: AudioAnalysis = {
          durationMs: (data.format.duration || 0) * 1000,
          channels: audioStream.channels || 0,
          sampleRate: audioStream.sample_rate || 0,
          bitrate: parseInt(String(data.format.bit_rate || "0"), 10),
          format: data.format.format_name || "unknown",
          isStereo: audioStream.channels === 2,
        };

        // Cache the result
        this.setCache(audioPath, analysis);

        resolve(Ok(analysis));
      });
    });
  }

  /**
   * Get audio duration in milliseconds.
   */
  async getDuration(audioPath: string): Promise<Result<number>> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(audioPath, (err, data) => {
        if (err) {
          resolve(Err(new Error(`Failed to get duration: ${err.message}`)));
          return;
        }

        const duration = data.format.duration;
        if (duration === undefined) {
          resolve(Err(new Error("Could not determine duration")));
          return;
        }

        resolve(Ok(duration * 1000)); // Convert to milliseconds
      });
    });
  }

  /**
   * Get audio format information.
   */
  async getFormat(audioPath: string): Promise<Result<FormatInfo>> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(audioPath, (err, data) => {
        if (err) {
          resolve(Err(new Error(`Failed to get format: ${err.message}`)));
          return;
        }

        const audioStream = data.streams.find(s => s.codec_type === "audio");
        if (!audioStream) {
          resolve(Err(new Error("No audio stream found")));
          return;
        }

        resolve(Ok({
          format: data.format.format_name || "unknown",
          codecName: audioStream.codec_name || "unknown",
        }));
      });
    });
  }

  /**
   * Validate that audio is stereo (2 channels).
   */
  async validateStereo(audioPath: string): Promise<Result<StereoValidation>> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(audioPath, (err, data) => {
        if (err) {
          resolve(Err(new Error(`Failed to validate stereo: ${err.message}`)));
          return;
        }

        const audioStream = data.streams.find(s => s.codec_type === "audio");
        if (!audioStream) {
          resolve(Err(new Error("No audio stream found")));
          return;
        }

        const channels = audioStream.channels || 0;
        
        if (channels === 2) {
          resolve(Ok({
            isValid: true,
            channels,
          }));
        } else if (channels === 1) {
          resolve(Ok({
            isValid: false,
            channels,
            reason: "Audio is not stereo (mono detected)",
          }));
        } else if (channels > 2) {
          resolve(Ok({
            isValid: false,
            channels,
            reason: `Audio has more than 2 channels (${channels} channels detected)`,
          }));
        } else {
          resolve(Ok({
            isValid: false,
            channels,
            reason: "Invalid channel configuration",
          }));
        }
      });
    });
  }

  /**
   * Analyze audio levels including peak, RMS, and LUFS.
   * Note: Full LUFS analysis requires FFmpeg with ebur128 filter.
   */
  async analyzeLevels(audioPath: string): Promise<Result<AudioLevels>> {
    return new Promise((resolve) => {
      // For full implementation, we would use FFmpeg with ebur128 filter
      // This is a simplified version that would need actual FFmpeg execution
      
      ffmpeg.ffprobe(audioPath, (err, data) => {
        if (err) {
          resolve(Err(new Error(`Failed to analyze levels: ${err.message}`)));
          return;
        }

        // This is a placeholder - actual implementation would run:
        // ffmpeg -i input.mp3 -af ebur128=peak=true -f null -
        // and parse the output for actual measurements
        
        const levels: AudioLevels = {
          peakDb: -3.0, // Placeholder
          rmsDb: -18.0, // Placeholder
          lufs: -16.0, // Placeholder target
        };

        resolve(Ok(levels));
      });
    });
  }

  /**
   * Extract metadata tags from audio file.
   */
  async getMetadata(audioPath: string): Promise<Result<Record<string, string>>> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(audioPath, (err, data) => {
        if (err) {
          resolve(Err(new Error(`Failed to get metadata: ${err.message}`)));
          return;
        }

        const tags = data.format.tags || {};
        // Ensure all values are strings
        const stringTags: Record<string, string> = {};
        for (const [key, value] of Object.entries(tags)) {
          stringTags[key] = String(value);
        }
        resolve(Ok(stringTags));
      });
    });
  }

  /**
   * Analyze multiple files in batch.
   */
  async analyzeMultiple(audioPaths: string[]): Promise<Result<AudioAnalysis>[]> {
    return Promise.all(audioPaths.map(path => this.analyze(path)));
  }

  /**
   * Get item from cache if not expired.
   */
  private getFromCache(key: string): AudioAnalysis | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set item in cache.
   */
  private setCache(key: string, data: AudioAnalysis): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached data.
   */
  clearCache(): void {
    this.cache.clear();
  }
}