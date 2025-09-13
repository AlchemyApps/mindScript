import type { z } from "zod";
import type { AudioJobSchema } from "@mindscript/schemas";

// Export the inferred AudioJob type
export type AudioJob = z.infer<typeof AudioJobSchema>;

// Result type for functional error handling
export type Result<T, E = Error> = 
  | { isOk: true; value: T }
  | { isOk: false; error: E };

export const Ok = <T>(value: T): Result<T> => ({
  isOk: true,
  value,
});

export const Err = <E = Error>(error: E): Result<never, E> => ({
  isOk: false,
  error,
});

// FFmpeg command builder types
export interface FFmpegCommand {
  inputs: FFmpegInput[];
  filters: FFmpegFilter[];
  outputs: FFmpegOutput[];
  globalOptions?: string[];
}

export interface FFmpegInput {
  source: string;
  options?: string[];
}

export interface FFmpegFilter {
  name: string;
  params?: Record<string, string | number>;
}

export interface FFmpegOutput {
  target: string;
  options?: string[];
}

// Audio processing pipeline types
export interface AudioPipeline {
  id: string;
  job: AudioJob;
  status: PipelineStatus;
  progress?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export type PipelineStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

// Voice synthesis types
export interface VoiceSynthesisRequest {
  text: string;
  provider: "openai" | "elevenlabs";
  voiceId: string;
  options?: {
    speed?: number;
    pitch?: number;
    emphasis?: number;
  };
}

export interface VoiceSynthesisResponse {
  audioUrl: string;
  durationMs: number;
  format: "mp3" | "wav";
  sampleRate: number;
}

// Audio analysis types
export interface AudioAnalysis {
  durationMs: number;
  channels: number;
  sampleRate: number;
  bitrate?: number;
  format: string;
  isStereo: boolean;
  peakLevel?: number;
  rmsLevel?: number;
  lufs?: number;
}

// Tone generation types
export interface ToneGenerator {
  type: "solfeggio" | "binaural";
  frequency?: number; // For solfeggio
  band?: "delta" | "theta" | "alpha" | "beta" | "gamma"; // For binaural
  beatHz?: number; // For binaural
  carrierHz?: number; // For binaural
  wave?: "sine" | "triangle" | "square";
  gainDb: number;
  fadeIn?: number;
  fadeOut?: number;
}

// Audio layer configuration
export interface AudioLayer {
  type: "voice" | "background" | "solfeggio" | "binaural";
  source?: string; // URL or file path
  generator?: ToneGenerator; // For generated tones
  gainDb: number;
  enabled: boolean;
  startTime?: number; // Offset in seconds
  endTime?: number; // Duration limit
}

// Render result
export interface RenderResult {
  outputUrl: string;
  durationMs: number;
  sizeBytes: number;
  format: "mp3" | "wav";
  channels: number;
  sampleRate: number;
  bitrate?: number;
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    year?: number;
    comment?: string;
  };
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}