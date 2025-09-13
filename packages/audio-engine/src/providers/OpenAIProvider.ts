let OpenAI: any;
try {
  OpenAI = require("openai").default;
} catch {
  // Module not installed, will be mocked in tests
  OpenAI = class OpenAI {
    audio = { speech: { create: () => Promise.reject(new Error("OpenAI SDK not installed")) } };
  };
}
import { BaseTTSProvider } from "./TTSProvider.interface";
import { Result, Ok, Err } from "../types";
import type {
  TTSSynthesisRequest,
  TTSSynthesisResponse,
  TTSVoice,
  TTSProviderConfig,
  RateLimitConfig,
  OpenAIModel,
  OpenAIVoice,
  OpenAIFormat,
  TTSError,
  TTSErrorCode,
} from "../types/tts.types";

/**
 * OpenAI TTS Provider implementation
 * Supports all 6 OpenAI voices with TTS-1 and TTS-1-HD models
 */
export class OpenAIProvider extends BaseTTSProvider {
  private client: OpenAI | null = null;
  private static readonly VOICES: Record<OpenAIVoice, Partial<TTSVoice>> = {
    alloy: { 
      name: "Alloy", 
      gender: "neutral",
      description: "Neutral and balanced voice"
    },
    echo: { 
      name: "Echo",
      gender: "male",
      description: "Male voice with depth"
    },
    fable: { 
      name: "Fable",
      gender: "neutral",
      description: "British-accented voice",
      accent: "British"
    },
    onyx: { 
      name: "Onyx",
      gender: "male",
      description: "Deep male voice"
    },
    nova: { 
      name: "Nova",
      gender: "female",
      description: "Female voice"
    },
    shimmer: { 
      name: "Shimmer",
      gender: "female",
      description: "Soft female voice"
    }
  };

  constructor(
    config?: TTSProviderConfig,
    rateLimitConfig?: RateLimitConfig
  ) {
    const apiKey = config?.apiKey || process.env.OPENAI_API_KEY || "";
    super(
      { ...config, apiKey },
      rateLimitConfig || { requestsPerMinute: 50, concurrentRequests: 5 }
    );

    if (this.config.apiKey) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
        timeout: this.config.timeout || 60000,
      });
    }
  }

  getProviderName(): string {
    return "openai";
  }

  async synthesize(request: TTSSynthesisRequest): Promise<Result<TTSSynthesisResponse>> {
    // Validate request
    const validation = this.validateRequest(request);
    if (!validation.isOk) {
      return validation as Result<never>;
    }

    if (!this.client) {
      return Err(new Error("OpenAI client not initialized. API key required."));
    }

    // Validate voice
    if (!this.isValidVoice(request.voice)) {
      return Err(new Error(`Invalid voice: ${request.voice}. Must be one of: ${Object.keys(OpenAIProvider.VOICES).join(", ")}`));
    }

    // Normalize text
    const normalizedText = this.normalizeText(request.text);

    // Prepare request parameters
    const model: OpenAIModel = (request.model as OpenAIModel) || "tts-1";
    const format: OpenAIFormat = (request.format as OpenAIFormat) || "mp3";
    const speed = request.speed || 1.0;

    try {
      // Apply rate limiting and retry logic
      const response = await this.withRateLimit(() =>
        this.withRetry(async () => {
          const response = await this.client!.audio.speech.create({
            model,
            voice: request.voice as OpenAIVoice,
            input: normalizedText,
            response_format: format,
            speed,
          });

          // Convert response to Buffer
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        })
      );

      return Ok({
        audioData: response,
        format,
        charactersUsed: normalizedText.length,
        modelUsed: model,
        voiceUsed: request.voice,
        cached: false,
      });
    } catch (error) {
      return Err(error as Error);
    }
  }

  async synthesizeStream?(request: TTSSynthesisRequest): Promise<Result<AsyncIterable<Uint8Array>>> {
    // Validate request
    const validation = this.validateRequest(request);
    if (!validation.isOk) {
      return validation as Result<never>;
    }

    if (!this.client) {
      return Err(new Error("OpenAI client not initialized. API key required."));
    }

    // Validate voice
    if (!this.isValidVoice(request.voice)) {
      return Err(new Error(`Invalid voice: ${request.voice}`));
    }

    // Normalize text
    const normalizedText = this.normalizeText(request.text);

    // Prepare request parameters
    const model: OpenAIModel = (request.model as OpenAIModel) || "tts-1";
    const format: OpenAIFormat = (request.format as OpenAIFormat) || "mp3";
    const speed = request.speed || 1.0;

    try {
      // Apply rate limiting
      const stream = await this.withRateLimit(async () => {
        const response = await this.client!.audio.speech.create({
          model,
          voice: request.voice as OpenAIVoice,
          input: normalizedText,
          response_format: format,
          speed,
        });

        // If the response is already a stream, return it
        if (Symbol.asyncIterator in response) {
          return response as AsyncIterable<Uint8Array>;
        }

        // Otherwise, create a stream from the response
        async function* streamFromResponse(): AsyncIterable<Uint8Array> {
          const buffer = await response.arrayBuffer();
          yield new Uint8Array(buffer);
        }

        return streamFromResponse();
      });

      return Ok(stream);
    } catch (error) {
      return Err(error as Error);
    }
  }

  async getAvailableVoices(): Promise<Result<TTSVoice[]>> {
    const voices: TTSVoice[] = Object.entries(OpenAIProvider.VOICES).map(
      ([id, metadata]) => ({
        id,
        name: metadata.name!,
        description: metadata.description,
        provider: "openai",
        gender: metadata.gender,
        accent: metadata.accent,
        languages: ["en"], // OpenAI voices primarily support English
      })
    );

    return Ok(voices);
  }

  private isValidVoice(voice: string): voice is OpenAIVoice {
    return voice in OpenAIProvider.VOICES;
  }
}