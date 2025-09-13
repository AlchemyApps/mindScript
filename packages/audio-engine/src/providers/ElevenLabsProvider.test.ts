import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ElevenLabsProvider } from "./ElevenLabsProvider";
import type { TTSSynthesisRequest, ElevenLabsVoiceSettings } from "../types/tts.types";

// Mock ElevenLabs SDK
vi.mock("elevenlabs", () => {
  const mockGenerate = vi.fn();
  const mockVoices = vi.fn();
  return {
    ElevenLabsClient: class ElevenLabsClient {
      textToSpeech = {
        convert: mockGenerate,
      };
      voices = {
        getAll: mockVoices,
      };
      static mockGenerate = mockGenerate;
      static mockVoices = mockVoices;
    }
  };
}, { virtual: true });

describe("ElevenLabsProvider", () => {
  let provider: ElevenLabsProvider;
  let mockGenerate: any;
  let mockVoices: any;

  beforeEach(() => {
    // Clear environment variables
    delete process.env.ELEVENLABS_API_KEY;
    
    // Get references to mocks
    const ElevenLabsClient = require("elevenlabs").ElevenLabsClient;
    mockGenerate = ElevenLabsClient.mockGenerate;
    mockVoices = ElevenLabsClient.mockVoices;
    mockGenerate.mockClear();
    mockVoices.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with API key from config", () => {
      provider = new ElevenLabsProvider({ apiKey: "test-key" });
      expect(provider.isAvailable()).toBe(true);
      expect(provider.getProviderName()).toBe("elevenlabs");
    });

    it("should initialize with API key from environment", () => {
      process.env.ELEVENLABS_API_KEY = "env-test-key";
      provider = new ElevenLabsProvider({} as any);
      expect(provider.isAvailable()).toBe(true);
    });

    it("should not be available without API key", () => {
      provider = new ElevenLabsProvider({} as any);
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe("synthesize", () => {
    beforeEach(() => {
      provider = new ElevenLabsProvider({ apiKey: "test-key" });
    });

    it("should synthesize text with default settings", async () => {
      const mockAudioBuffer = Buffer.from("mock audio data");
      mockGenerate.mockResolvedValue(mockAudioBuffer);

      const request: TTSSynthesisRequest = {
        text: "Hello, world!",
        voice: "21m00Tcm4TlvDq8ikWAM" // Rachel voice ID
      };

      const result = await provider.synthesize(request);
      
      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.audioData).toBeInstanceOf(Buffer);
        expect(result.value.format).toBe("mp3_44100_128");
        expect(result.value.voiceUsed).toBe("21m00Tcm4TlvDq8ikWAM");
        expect(result.value.modelUsed).toBe("eleven_monolingual_v1");
        expect(result.value.charactersUsed).toBe(13);
        expect(result.value.cached).toBe(false);
      }

      expect(mockGenerate).toHaveBeenCalledWith(
        "21m00Tcm4TlvDq8ikWAM",
        {
          text: "Hello, world!",
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true
          }
        }
      );
    });

    it("should use specified model", async () => {
      mockGenerate.mockResolvedValue(Buffer.from("audio"));

      const request: TTSSynthesisRequest = {
        text: "Test",
        voice: "voice-id",
        model: "eleven_turbo_v2"
      };

      await provider.synthesize(request);

      expect(mockGenerate).toHaveBeenCalledWith(
        "voice-id",
        expect.objectContaining({
          model_id: "eleven_turbo_v2"
        })
      );
    });

    it("should apply custom voice settings", async () => {
      mockGenerate.mockResolvedValue(Buffer.from("audio"));

      const voiceSettings: ElevenLabsVoiceSettings = {
        stability: 0.8,
        similarity_boost: 0.9,
        style: 0.5,
        use_speaker_boost: false
      };

      const provider = new ElevenLabsProvider({ 
        apiKey: "test-key",
        voiceSettings 
      } as any);

      await provider.synthesize({
        text: "Test",
        voice: "voice-id"
      });

      expect(mockGenerate).toHaveBeenCalledWith(
        "voice-id",
        expect.objectContaining({
          voice_settings: voiceSettings
        })
      );
    });

    it("should handle streaming latency optimization", async () => {
      mockGenerate.mockResolvedValue(Buffer.from("audio"));

      const request: TTSSynthesisRequest = {
        text: "Test",
        voice: "voice-id",
        streamingLatencyOptimization: 3
      };

      await provider.synthesize(request);

      expect(mockGenerate).toHaveBeenCalledWith(
        "voice-id",
        expect.objectContaining({
          optimize_streaming_latency: 3
        })
      );
    });

    it("should chunk long text automatically", async () => {
      mockGenerate.mockResolvedValue(Buffer.from("audio chunk"));

      const longText = "a".repeat(4500) + " " + "b".repeat(4500); // 9001 chars
      
      const result = await provider.synthesize({
        text: longText,
        voice: "voice-id"
      });

      // Should be called twice for two chunks
      expect(mockGenerate).toHaveBeenCalledTimes(2);
      
      expect(result.isOk).toBe(true);
      if (result.isOk) {
        // Audio should be concatenated
        expect(result.value.audioData.length).toBeGreaterThan(0);
        expect(result.value.charactersUsed).toBe(9001);
      }
    });

    it("should validate text is not empty", async () => {
      const result = await provider.synthesize({
        text: "",
        voice: "voice-id"
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Text cannot be empty");
      }
    });

    it("should normalize text before synthesis", async () => {
      mockGenerate.mockResolvedValue(Buffer.from("audio"));

      const request: TTSSynthesisRequest = {
        text: "  Hello   world!  \n\n  ",
        voice: "voice-id"
      };

      await provider.synthesize(request);

      expect(mockGenerate).toHaveBeenCalledWith(
        "voice-id",
        expect.objectContaining({
          text: "Hello world!"
        })
      );
    });

    it("should handle API errors gracefully", async () => {
      mockGenerate.mockRejectedValue(new Error("API error: Quota exceeded"));

      const result = await provider.synthesize({
        text: "Test",
        voice: "voice-id"
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain("API error");
      }
    });

    it("should retry on failure with exponential backoff", async () => {
      let attempts = 0;
      mockGenerate.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error("Temporary failure"));
        }
        return Promise.resolve(Buffer.from("audio"));
      });

      const result = await provider.synthesize({
        text: "Test",
        voice: "voice-id"
      });

      expect(result.isOk).toBe(true);
      expect(mockGenerate).toHaveBeenCalledTimes(3);
    });
  });

  describe("getAvailableVoices", () => {
    beforeEach(() => {
      provider = new ElevenLabsProvider({ apiKey: "test-key" });
    });

    it("should fetch and return available voices", async () => {
      const mockVoiceData = {
        voices: [
          {
            voice_id: "21m00Tcm4TlvDq8ikWAM",
            name: "Rachel",
            category: "premade",
            labels: {
              accent: "American",
              description: "Calm",
              age: "Young",
              gender: "Female",
              use_case: "Narration"
            },
            preview_url: "https://example.com/preview.mp3"
          },
          {
            voice_id: "ErXwobaYiN019PkySvjV",
            name: "Antoni",
            category: "premade",
            labels: {
              accent: "American",
              description: "Well-rounded",
              age: "Young",
              gender: "Male",
              use_case: "Narration"
            },
            preview_url: "https://example.com/preview2.mp3"
          }
        ]
      };

      mockVoices.mockResolvedValue(mockVoiceData);

      const result = await provider.getAvailableVoices();
      
      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toHaveLength(2);
        
        const rachel = result.value.find(v => v.id === "21m00Tcm4TlvDq8ikWAM");
        expect(rachel).toBeDefined();
        expect(rachel?.name).toBe("Rachel");
        expect(rachel?.gender).toBe("female");
        expect(rachel?.accent).toBe("American");
        expect(rachel?.age).toBe("young");
        expect(rachel?.provider).toBe("elevenlabs");
        expect(rachel?.previewUrl).toBe("https://example.com/preview.mp3");
      }
    });

    it("should handle API errors when fetching voices", async () => {
      mockVoices.mockRejectedValue(new Error("Failed to fetch voices"));

      const result = await provider.getAvailableVoices();
      
      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Failed to fetch voices");
      }
    });
  });

  describe("synthesizeStream", () => {
    beforeEach(() => {
      provider = new ElevenLabsProvider({ apiKey: "test-key" });
    });

    it("should support streaming synthesis", async () => {
      const chunks = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9])
      ];

      // Mock streaming response
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        }
      };

      mockGenerate.mockResolvedValue(mockStream);

      const result = await provider.synthesizeStream!({
        text: "Stream test",
        voice: "voice-id"
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        const collectedChunks: Uint8Array[] = [];
        for await (const chunk of result.value) {
          collectedChunks.push(chunk);
        }
        
        expect(collectedChunks).toHaveLength(3);
        expect(collectedChunks[0]).toEqual(chunks[0]);
      }
    });
  });

  describe("rate limiting", () => {
    it("should respect rate limits based on subscription", async () => {
      const provider = new ElevenLabsProvider(
        { apiKey: "test-key" },
        { requestsPerMinute: 30, concurrentRequests: 3 }
      );

      mockGenerate.mockResolvedValue(Buffer.from("audio"));

      const startTime = Date.now();
      
      // Make 4 concurrent requests (should queue the 4th)
      const promises = [
        provider.synthesize({ text: "Test 1", voice: "voice-id" }),
        provider.synthesize({ text: "Test 2", voice: "voice-id" }),
        provider.synthesize({ text: "Test 3", voice: "voice-id" }),
        provider.synthesize({ text: "Test 4", voice: "voice-id" })
      ];

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockGenerate).toHaveBeenCalledTimes(4);
      
      // With 30 req/min = 0.5 req/sec = 2s per request
      // The 4th request should wait
      expect(duration).toBeGreaterThanOrEqual(2000);
    });
  });

  describe("text chunking", () => {
    it("should intelligently chunk text at sentence boundaries", async () => {
      mockGenerate.mockResolvedValue(Buffer.from("audio"));

      const text = Array(100).fill("This is a sentence.").join(" "); // ~1900 chars
      text + " " + Array(100).fill("Another sentence here.").join(" "); // Another ~2200 chars
      
      const provider = new ElevenLabsProvider({ apiKey: "test-key" });
      
      const result = await provider.synthesize({
        text,
        voice: "voice-id"
      });

      // Should chunk intelligently
      expect(mockGenerate.mock.calls.length).toBeGreaterThanOrEqual(1);
      
      // Each chunk should be under 5000 chars
      for (const call of mockGenerate.mock.calls) {
        const chunkText = call[1].text;
        expect(chunkText.length).toBeLessThanOrEqual(5000);
      }
    });
  });
});