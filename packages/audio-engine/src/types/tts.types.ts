import { Result } from "../types";

/**
 * Common TTS provider interface
 */
export interface TTSProvider {
  /**
   * Synthesize text to speech
   */
  synthesize(request: TTSSynthesisRequest): Promise<Result<TTSSynthesisResponse>>;
  
  /**
   * Stream synthesized audio
   */
  synthesizeStream?(request: TTSSynthesisRequest): Promise<Result<AsyncIterable<Uint8Array>>>;
  
  /**
   * Get available voices for this provider
   */
  getAvailableVoices(): Promise<Result<TTSVoice[]>>;
  
  /**
   * Check if provider is available and configured
   */
  isAvailable(): boolean;
  
  /**
   * Get provider name
   */
  getProviderName(): string;
}

/**
 * TTS synthesis request
 */
export interface TTSSynthesisRequest {
  text: string;
  voice: string;
  model?: string;
  speed?: number; // 0.25 to 4.0
  pitch?: number; // Provider-specific
  format?: "mp3" | "opus" | "aac" | "flac" | "wav";
  streamingLatencyOptimization?: number; // For ElevenLabs
}

/**
 * TTS synthesis response
 */
export interface TTSSynthesisResponse {
  audioData: Buffer;
  format: string;
  durationMs?: number;
  charactersUsed: number;
  modelUsed: string;
  voiceUsed: string;
  cached: boolean;
}

/**
 * TTS voice information
 */
export interface TTSVoice {
  id: string;
  name: string;
  description?: string;
  previewUrl?: string;
  provider: "openai" | "elevenlabs" | "custom";
  languages?: string[];
  gender?: "male" | "female" | "neutral";
  age?: "young" | "middle" | "old";
  accent?: string;
  style?: string;
  useCase?: string;
}

/**
 * OpenAI-specific types
 */
export type OpenAIModel = "tts-1" | "tts-1-hd";
export type OpenAIVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export type OpenAIFormat = "mp3" | "opus" | "aac" | "flac";

/**
 * ElevenLabs-specific types
 */
export interface ElevenLabsVoiceSettings {
  stability: number; // 0-1
  similarity_boost: number; // 0-1
  style?: number; // 0-1
  use_speaker_boost?: boolean;
}

export type ElevenLabsModel = 
  | "eleven_monolingual_v1" 
  | "eleven_multilingual_v1"
  | "eleven_multilingual_v2"
  | "eleven_turbo_v2"
  | "eleven_turbo_v2_5";

/**
 * Provider configuration
 */
export interface TTSProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Cache configuration
 */
export interface TTSCacheConfig {
  enabled: boolean;
  directory: string;
  ttlSeconds: number;
  maxSizeMB: number;
  compressionEnabled?: boolean;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute?: number;
  concurrentRequests?: number;
}

/**
 * TTS error types
 */
export class TTSError extends Error {
  constructor(
    message: string,
    public code: TTSErrorCode,
    public provider?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "TTSError";
  }
}

export enum TTSErrorCode {
  PROVIDER_NOT_CONFIGURED = "PROVIDER_NOT_CONFIGURED",
  API_KEY_MISSING = "API_KEY_MISSING",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_VOICE = "INVALID_VOICE",
  INVALID_MODEL = "INVALID_MODEL",
  TEXT_TOO_LONG = "TEXT_TOO_LONG",
  NETWORK_ERROR = "NETWORK_ERROR",
  API_ERROR = "API_ERROR",
  CACHE_ERROR = "CACHE_ERROR",
  AUDIO_FORMAT_ERROR = "AUDIO_FORMAT_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Cache entry
 */
export interface CacheEntry {
  key: string;
  audioData: Buffer;
  metadata: {
    text: string;
    voice: string;
    model: string;
    provider: string;
    format: string;
    createdAt: Date;
    expiresAt: Date;
    sizeBytes: number;
    accessCount: number;
    lastAccessedAt: Date;
  };
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  totalEntries: number;
  totalSizeBytes: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  averageEntrySize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}