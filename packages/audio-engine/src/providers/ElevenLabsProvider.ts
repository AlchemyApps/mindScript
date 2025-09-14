let ElevenLabsClient: any;
try {
  ElevenLabsClient = require("elevenlabs").ElevenLabsClient;
} catch {
  // Module not installed, will be mocked in tests
  ElevenLabsClient = class ElevenLabsClient {
    textToSpeech = { convert: () => Promise.reject(new Error("ElevenLabs SDK not installed")) };
    voices = { getAll: () => Promise.reject(new Error("ElevenLabs SDK not installed")) };
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
  ElevenLabsModel,
  ElevenLabsVoiceSettings,
} from "../types/tts.types";

interface ElevenLabsConfig extends TTSProviderConfig {
  voiceSettings?: ElevenLabsVoiceSettings;
}

/**
 * ElevenLabs TTS Provider implementation
 * Supports custom voice cloning and advanced voice settings
 */
export class ElevenLabsProvider extends BaseTTSProvider {
  private client: typeof ElevenLabsClient | null = null;
  private voiceSettings: ElevenLabsVoiceSettings;
  private static readonly MAX_CHUNK_SIZE = 5000; // ElevenLabs character limit

  constructor(
    config?: ElevenLabsConfig,
    rateLimitConfig?: RateLimitConfig
  ) {
    const apiKey = config?.apiKey || process.env.ELEVENLABS_API_KEY || "";
    super(
      { ...config, apiKey },
      rateLimitConfig || { requestsPerMinute: 30, concurrentRequests: 3 } // Default for free tier
    );

    this.voiceSettings = config?.voiceSettings || {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: true,
    };

    if (this.config.apiKey) {
      this.client = new ElevenLabsClient({
        apiKey: this.config.apiKey,
      });
    }
  }

  getProviderName(): string {
    return "elevenlabs";
  }

  async synthesize(request: TTSSynthesisRequest): Promise<Result<TTSSynthesisResponse>> {
    // Validate request
    const validation = this.validateRequest(request);
    if (!validation.isOk) {
      return validation as Result<never>;
    }

    if (!this.client) {
      return Err(new Error("ElevenLabs client not initialized. API key required."));
    }

    // Normalize text
    const normalizedText = this.normalizeText(request.text);

    // Handle text chunking for long content
    const chunks = this.chunkText(normalizedText);
    
    // Prepare request parameters
    const model: ElevenLabsModel = (request.model as ElevenLabsModel) || "eleven_monolingual_v1";
    const format = request.format || "mp3_44100_128";

    try {
      const audioBuffers: Buffer[] = [];

      // Process each chunk
      for (const chunk of chunks) {
        const audioData = await this.withRateLimit(() =>
          this.withRetry(async () => {
            const requestParams: any = {
              text: chunk,
              model_id: model,
              voice_settings: this.voiceSettings,
            };

            // Add streaming optimization if specified
            if (request.streamingLatencyOptimization !== undefined) {
              requestParams.optimize_streaming_latency = request.streamingLatencyOptimization;
            }

            const response = await this.client!.textToSpeech.convert(
              request.voice,
              requestParams
            );

            // Handle response based on type
            if (Buffer.isBuffer(response)) {
              return response;
            } else if (response instanceof Uint8Array) {
              return Buffer.from(response);
            } else {
              // If it's a stream or other type, collect it
              const chunks: Buffer[] = [];
              for await (const chunk of response as AsyncIterable<Uint8Array>) {
                chunks.push(Buffer.from(chunk));
              }
              return Buffer.concat(chunks);
            }
          })
        );

        audioBuffers.push(audioData);
      }

      // Concatenate all audio chunks
      const finalAudio = Buffer.concat(audioBuffers);

      return Ok({
        audioData: finalAudio,
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
      return Err(new Error("ElevenLabs client not initialized. API key required."));
    }

    // Normalize text
    const normalizedText = this.normalizeText(request.text);

    // For streaming, we can't chunk - text must be under limit
    if (normalizedText.length > ElevenLabsProvider.MAX_CHUNK_SIZE) {
      return Err(new Error(`Text exceeds maximum length for streaming (${ElevenLabsProvider.MAX_CHUNK_SIZE} characters)`));
    }

    // Prepare request parameters
    const model: ElevenLabsModel = (request.model as ElevenLabsModel) || "eleven_monolingual_v1";

    try {
      const stream = await this.withRateLimit(async () => {
        const requestParams: any = {
          text: normalizedText,
          model_id: model,
          voice_settings: this.voiceSettings,
        };

        // Add streaming optimization if specified
        if (request.streamingLatencyOptimization !== undefined) {
          requestParams.optimize_streaming_latency = request.streamingLatencyOptimization;
        }

        const response = await this.client!.textToSpeech.convert(
          request.voice,
          requestParams
        );

        // If response is already a stream, return it
        if (Symbol.asyncIterator in response) {
          return response as AsyncIterable<Uint8Array>;
        }

        // Otherwise, create a stream from the response
        async function* streamFromResponse(): AsyncIterable<Uint8Array> {
          if (Buffer.isBuffer(response)) {
            yield new Uint8Array(response);
          } else if (response instanceof Uint8Array) {
            yield response;
          } else {
            // Collect and yield
            for await (const chunk of response as AsyncIterable<Uint8Array>) {
              yield chunk;
            }
          }
        }

        return streamFromResponse();
      });

      return Ok(stream);
    } catch (error) {
      return Err(error as Error);
    }
  }

  async getAvailableVoices(): Promise<Result<TTSVoice[]>> {
    if (!this.client) {
      return Err(new Error("ElevenLabs client not initialized. API key required."));
    }

    try {
      const response = await this.withRateLimit(() =>
        this.withRetry(async () => {
          return await this.client!.voices.getAll();
        })
      );

      const voices: TTSVoice[] = response.voices.map((voice: any) => ({
        id: voice.voice_id,
        name: voice.name,
        description: voice.labels?.description,
        provider: "elevenlabs",
        gender: this.parseGender(voice.labels?.gender),
        age: this.parseAge(voice.labels?.age),
        accent: voice.labels?.accent,
        useCase: voice.labels?.use_case,
        previewUrl: voice.preview_url,
        languages: voice.languages || ["en"],
      }));

      return Ok(voices);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Chunk text intelligently at sentence boundaries
   */
  private chunkText(text: string): string[] {
    if (text.length <= ElevenLabsProvider.MAX_CHUNK_SIZE) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > ElevenLabsProvider.MAX_CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          // Single sentence exceeds limit, split by words
          const words = sentence.split(" ");
          let wordChunk = "";
          
          for (const word of words) {
            if ((wordChunk + " " + word).length > ElevenLabsProvider.MAX_CHUNK_SIZE) {
              chunks.push(wordChunk.trim());
              wordChunk = word;
            } else {
              wordChunk += (wordChunk ? " " : "") + word;
            }
          }
          
          if (wordChunk) {
            currentChunk = wordChunk;
          }
        }
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private parseGender(gender?: string): "male" | "female" | "neutral" | undefined {
    if (!gender) return undefined;
    const normalized = gender.toLowerCase();
    if (normalized === "male") return "male";
    if (normalized === "female") return "female";
    return "neutral";
  }

  private parseAge(age?: string): "young" | "middle" | "old" | undefined {
    if (!age) return undefined;
    const normalized = age.toLowerCase();
    if (normalized.includes("young")) return "young";
    if (normalized.includes("old")) return "old";
    return "middle";
  }
}