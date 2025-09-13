import { Result } from "../types";
import type {
  TTSProvider,
  TTSSynthesisRequest,
  TTSSynthesisResponse,
  TTSVoice,
  TTSProviderConfig,
  RateLimitConfig,
} from "../types/tts.types";

/**
 * Abstract base class for TTS providers
 * Implements common functionality like rate limiting and retries
 */
export abstract class BaseTTSProvider implements TTSProvider {
  protected config: TTSProviderConfig;
  protected rateLimitConfig?: RateLimitConfig;
  protected requestQueue: Array<() => Promise<void>> = [];
  protected activeRequests = 0;
  protected lastRequestTime = 0;
  protected retryCount = 0;

  constructor(config: TTSProviderConfig, rateLimitConfig?: RateLimitConfig) {
    this.config = config;
    this.rateLimitConfig = rateLimitConfig;
  }

  /**
   * Synthesize text to speech with rate limiting and retries
   */
  abstract synthesize(request: TTSSynthesisRequest): Promise<Result<TTSSynthesisResponse>>;

  /**
   * Stream synthesized audio (optional)
   */
  abstract synthesizeStream?(request: TTSSynthesisRequest): Promise<Result<AsyncIterable<Uint8Array>>>;

  /**
   * Get available voices for this provider
   */
  abstract getAvailableVoices(): Promise<Result<TTSVoice[]>>;

  /**
   * Check if provider is available and configured
   */
  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Get provider name
   */
  abstract getProviderName(): string;

  /**
   * Apply rate limiting to a request
   */
  protected async withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.rateLimitConfig) {
      return fn();
    }

    const { requestsPerMinute, concurrentRequests = 5 } = this.rateLimitConfig;
    
    // Wait if we have too many concurrent requests
    while (this.activeRequests >= concurrentRequests) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate time to wait based on rate limit
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minTimeBetweenRequests = 60000 / requestsPerMinute;

    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const waitTime = minTimeBetweenRequests - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.activeRequests++;
    this.lastRequestTime = Date.now();

    try {
      return await fn();
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = this.config.maxRetries ?? 3,
    baseDelay: number = this.config.retryDelay ?? 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, etc.
        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
        
        await new Promise(resolve => 
          setTimeout(resolve, Math.min(delay + jitter, 30000)) // Max 30s delay
        );
      }
    }

    throw lastError;
  }

  /**
   * Validate synthesis request
   */
  protected validateRequest(request: TTSSynthesisRequest): Result<void> {
    if (!request.text || request.text.trim().length === 0) {
      return {
        isOk: false,
        error: new Error("Text cannot be empty")
      };
    }

    if (request.text.length > 5000) {
      return {
        isOk: false,
        error: new Error("Text exceeds maximum length of 5000 characters")
      };
    }

    if (request.speed !== undefined && (request.speed < 0.25 || request.speed > 4.0)) {
      return {
        isOk: false,
        error: new Error("Speed must be between 0.25 and 4.0")
      };
    }

    return { isOk: true, value: undefined };
  }

  /**
   * Normalize text for TTS processing
   */
  protected normalizeText(text: string): string {
    return text
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      // Remove special characters that might cause issues
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // Trim whitespace
      .trim();
  }
}