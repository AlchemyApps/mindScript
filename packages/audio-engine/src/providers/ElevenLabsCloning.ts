/**
 * ElevenLabs Voice Cloning Provider
 * Handles voice cloning operations with ElevenLabs API
 */

let ElevenLabsClient: any;
try {
  ElevenLabsClient = require("elevenlabs").ElevenLabsClient;
} catch {
  // Module not installed, will be mocked in tests
  ElevenLabsClient = class ElevenLabsClient {
    voices = {
      add: () => Promise.reject(new Error("ElevenLabs SDK not installed")),
      get: () => Promise.reject(new Error("ElevenLabs SDK not installed")),
      delete: () => Promise.reject(new Error("ElevenLabs SDK not installed")),
      getAll: () => Promise.reject(new Error("ElevenLabs SDK not installed")),
    };
    textToSpeech = {
      convert: () => Promise.reject(new Error("ElevenLabs SDK not installed")),
    };
  };
}

import { Result, Ok, Err } from "../types";
import {
  type VoiceCloneRequest,
  type VoiceCloneResponse,
  type VoiceConsent,
  type VoiceUpload,
  voiceConsentSchema,
  voiceUploadSchema,
} from "@mindscript/schemas";

interface ElevenLabsVoiceDetails {
  voice_id: string;
  name: string;
  description?: string;
  labels?: Record<string, any>;
  samples?: Array<{ sample_id: string; file_name: string; mime_type: string; size_bytes: number }>;
  category?: string;
}

interface ElevenLabsCloningConfig {
  apiKey?: string;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * ElevenLabs Voice Cloning Provider
 * Implements voice cloning functionality with consent verification
 */
export class ElevenLabsVoiceCloning {
  private client: typeof ElevenLabsClient | null = null;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config?: ElevenLabsCloningConfig) {
    const apiKey = config?.apiKey || process.env.ELEVENLABS_API_KEY || "";
    this.maxRetries = config?.maxRetries || 3;
    this.retryDelay = config?.retryDelay || 1000;

    if (apiKey) {
      this.client = new ElevenLabsClient({
        apiKey,
      });
    }
  }

  /**
   * Clone a voice from audio sample
   * Validates consent and audio requirements before processing
   */
  async cloneVoice(
    request: VoiceCloneRequest,
    audioBuffer: Buffer
  ): Promise<Result<VoiceCloneResponse>> {
    // Validate consent
    const consentValidation = this.validateConsent(request.consent);
    if (!consentValidation.isOk) {
      return Err(consentValidation.error);
    }

    // Validate upload data
    const uploadValidation = voiceUploadSchema.safeParse(request.uploadData);
    if (!uploadValidation.success) {
      return Err(new Error(`Invalid upload data: ${uploadValidation.error.message}`));
    }

    // Validate audio file
    const audioValidation = await this.validateAudioFile(audioBuffer, request.uploadData);
    if (!audioValidation.isOk) {
      return audioValidation as Result<never>;
    }

    if (!this.client) {
      return Err(new Error("ElevenLabs client not initialized. API key required."));
    }

    try {
      const startTime = Date.now();

      // Prepare voice add request
      const voiceAddRequest: any = {
        name: request.name,
        files: [audioBuffer],
      };

      if (request.description) {
        voiceAddRequest.description = request.description;
      }

      if (request.labels) {
        voiceAddRequest.labels = request.labels;
      }

      // Add voice with retry logic
      const response = await this.withRetry(async () => {
        return await this.client!.voices.add(voiceAddRequest);
      });

      const processingTime = Date.now() - startTime;

      return Ok({
        success: true,
        voiceId: response.voice_id,
        processingTime,
      });
    } catch (error) {
      return Ok({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Delete a cloned voice
   * Permanently removes the voice from ElevenLabs
   */
  async deleteVoice(voiceId: string): Promise<Result<boolean>> {
    if (!this.client) {
      return Err(new Error("ElevenLabs client not initialized. API key required."));
    }

    try {
      await this.withRetry(async () => {
        return await this.client!.voices.delete(voiceId);
      });

      return Ok(true);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Get details of a specific voice
   */
  async getVoiceDetails(voiceId: string): Promise<Result<ElevenLabsVoiceDetails>> {
    if (!this.client) {
      return Err(new Error("ElevenLabs client not initialized. API key required."));
    }

    try {
      const voice = await this.withRetry(async () => {
        return await this.client!.voices.get(voiceId);
      });

      return Ok(voice);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Generate preview audio for a cloned voice
   */
  async previewVoice(voiceId: string, text: string): Promise<Result<Buffer>> {
    if (!this.client) {
      return Err(new Error("ElevenLabs client not initialized. API key required."));
    }

    // Limit preview text length
    const previewText = text.slice(0, 500);

    try {
      const audioData = await this.withRetry(async () => {
        const response = await this.client!.textToSpeech.convert(voiceId, {
          text: previewText,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
          },
        });

        // Handle different response types
        if (Buffer.isBuffer(response)) {
          return response;
        } else if (response instanceof Uint8Array) {
          return Buffer.from(response);
        } else {
          // If it's a stream, collect it
          const chunks: Buffer[] = [];
          for await (const chunk of response as AsyncIterable<Uint8Array>) {
            chunks.push(Buffer.from(chunk));
          }
          return Buffer.concat(chunks);
        }
      });

      return Ok(audioData);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Get all user's cloned voices
   */
  async getUserVoices(): Promise<Result<ElevenLabsVoiceDetails[]>> {
    if (!this.client) {
      return Err(new Error("ElevenLabs client not initialized. API key required."));
    }

    try {
      const response = await this.withRetry(async () => {
        return await this.client!.voices.getAll();
      });

      // Filter only cloned voices
      const clonedVoices = response.voices.filter(
        (voice: ElevenLabsVoiceDetails) => voice.category === "cloned"
      );

      return Ok(clonedVoices);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Validate audio file meets requirements
   */
  async validateAudioFile(
    audioBuffer: Buffer,
    uploadData: VoiceUpload
  ): Promise<Result<boolean>> {
    // Check file size
    if (audioBuffer.length > 10485760) {
      return Err(new Error("Audio file must be less than 10MB"));
    }

    // Check duration
    if (uploadData.duration < 60) {
      return Err(new Error("Audio must be at least 60 seconds"));
    }

    if (uploadData.duration > 180) {
      return Err(new Error("Audio must be less than 180 seconds"));
    }

    // Basic format validation - check for common audio file signatures
    const isValidFormat = this.detectAudioFormat(audioBuffer);
    if (!isValidFormat) {
      return Err(new Error("Invalid audio format. Supported formats: MP3, WAV"));
    }

    // Check minimum quality
    if (uploadData.bitrate < 128000) {
      return Err(new Error("Audio bitrate must be at least 128kbps"));
    }

    if (uploadData.sampleRate < 22050) {
      return Err(new Error("Audio sample rate must be at least 22050Hz"));
    }

    return Ok(true);
  }

  /**
   * Validate consent requirements
   */
  private validateConsent(consent: VoiceConsent): Result<boolean> {
    const validation = voiceConsentSchema.safeParse(consent);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return Err(new Error(firstError.message));
    }

    // All consent flags must be true
    if (!consent.hasConsent) {
      return Err(new Error("Explicit consent is required"));
    }

    if (!consent.isOver18) {
      return Err(new Error("Must be 18 years or older"));
    }

    if (!consent.acceptsTerms) {
      return Err(new Error("Must accept terms of service"));
    }

    if (!consent.ownsVoice) {
      return Err(new Error("Must confirm voice ownership"));
    }

    if (!consent.understandsUsage) {
      return Err(new Error("Must understand usage terms"));
    }

    if (!consent.noImpersonation) {
      return Err(new Error("Must agree to no impersonation policy"));
    }

    return Ok(true);
  }

  /**
   * Detect audio format from buffer
   */
  private detectAudioFormat(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;

    // Check for MP3 (ID3 tag or MPEG sync)
    if (
      buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33 || // ID3
      (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) // MPEG sync
    ) {
      return true;
    }

    // Check for WAV (RIFF header)
    if (
      buffer[0] === 0x52 && buffer[1] === 0x49 &&
      buffer[2] === 0x46 && buffer[3] === 0x46
    ) {
      return true;
    }

    return false;
  }

  /**
   * Retry logic for API calls
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        // Check if error is retryable
        const errorMessage = (error as Error).message.toLowerCase();
        const isRetryable =
          errorMessage.includes("rate limit") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("network");

        if (isRetryable) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          return this.withRetry(fn, retries - 1);
        }
      }
      throw error;
    }
  }
}