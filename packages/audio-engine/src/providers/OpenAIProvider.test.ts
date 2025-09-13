import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAIProvider } from "./OpenAIProvider";
import { TTSErrorCode } from "../types/tts.types";
import type { TTSSynthesisRequest } from "../types/tts.types";

// Mock OpenAI SDK
vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: class OpenAI {
      audio = {
        speech: {
          create: mockCreate
        }
      };
      static mockCreate = mockCreate;
    }
  };
}, { virtual: true });

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;
  let mockCreate: any;

  beforeEach(() => {
    // Clear environment variables
    delete process.env.OPENAI_API_KEY;
    
    // Get reference to mock
    const OpenAI = require("openai").default;
    mockCreate = OpenAI.mockCreate;
    mockCreate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with API key from config", () => {
      provider = new OpenAIProvider({ apiKey: "test-key" });
      expect(provider.isAvailable()).toBe(true);
      expect(provider.getProviderName()).toBe("openai");
    });

    it("should initialize with API key from environment", () => {
      process.env.OPENAI_API_KEY = "env-test-key";
      provider = new OpenAIProvider({} as any);
      expect(provider.isAvailable()).toBe(true);
    });

    it("should not be available without API key", () => {
      provider = new OpenAIProvider({} as any);
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe("synthesize", () => {
    beforeEach(() => {
      provider = new OpenAIProvider({ apiKey: "test-key" });
    });

    it("should synthesize text with default settings", async () => {
      const mockAudioBuffer = Buffer.from("mock audio data");
      mockCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });

      const request: TTSSynthesisRequest = {
        text: "Hello, world!",
        voice: "alloy"
      };

      const result = await provider.synthesize(request);
      
      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.audioData).toBeInstanceOf(Buffer);
        expect(result.value.format).toBe("mp3");
        expect(result.value.voiceUsed).toBe("alloy");
        expect(result.value.modelUsed).toBe("tts-1");
        expect(result.value.charactersUsed).toBe(13);
        expect(result.value.cached).toBe(false);
      }

      expect(mockCreate).toHaveBeenCalledWith({
        model: "tts-1",
        voice: "alloy",
        input: "Hello, world!",
        response_format: "mp3",
        speed: 1.0
      });
    });

    it("should use tts-1-hd model when specified", async () => {
      mockCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(Buffer.from("audio").buffer)
      });

      const request: TTSSynthesisRequest = {
        text: "Test",
        voice: "nova",
        model: "tts-1-hd"
      };

      await provider.synthesize(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "tts-1-hd",
          voice: "nova"
        })
      );
    });

    it("should handle all supported voices", async () => {
      const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      mockCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(Buffer.from("audio").buffer)
      });

      for (const voice of voices) {
        const result = await provider.synthesize({
          text: "Test",
          voice
        });
        expect(result.isOk).toBe(true);
      }

      expect(mockCreate).toHaveBeenCalledTimes(6);
    });

    it("should support speed adjustment", async () => {
      mockCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(Buffer.from("audio").buffer)
      });

      const request: TTSSynthesisRequest = {
        text: "Test",
        voice: "alloy",
        speed: 1.5
      };

      await provider.synthesize(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          speed: 1.5
        })
      );
    });

    it("should validate speed range", async () => {
      const invalidSpeeds = [0.24, 4.01, -1, 5];

      for (const speed of invalidSpeeds) {
        const result = await provider.synthesize({
          text: "Test",
          voice: "alloy",
          speed
        });
        
        expect(result.isOk).toBe(false);
        if (!result.isOk) {
          expect(result.error.message).toContain("Speed must be between");
        }
      }
    });

    it("should support different audio formats", async () => {
      mockCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(Buffer.from("audio").buffer)
      });

      const formats = ["mp3", "opus", "aac", "flac"] as const;

      for (const format of formats) {
        const result = await provider.synthesize({
          text: "Test",
          voice: "alloy",
          format
        });

        expect(result.isOk).toBe(true);
        if (result.isOk) {
          expect(result.value.format).toBe(format);
        }
      }
    });

    it("should handle empty text", async () => {
      const result = await provider.synthesize({
        text: "",
        voice: "alloy"
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Text cannot be empty");
      }
    });

    it("should handle text exceeding maximum length", async () => {
      const longText = "a".repeat(5001);
      
      const result = await provider.synthesize({
        text: longText,
        voice: "alloy"
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("exceeds maximum length");
      }
    });

    it("should normalize text before synthesis", async () => {
      mockCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(Buffer.from("audio").buffer)
      });

      const request: TTSSynthesisRequest = {
        text: "  Hello   world!  \n\n  ",
        voice: "alloy"
      };

      await provider.synthesize(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          input: "Hello world!"
        })
      );
    });

    it("should handle API errors gracefully", async () => {
      mockCreate.mockRejectedValue(new Error("API error: Rate limit exceeded"));

      const result = await provider.synthesize({
        text: "Test",
        voice: "alloy"
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain("API error");
      }
    });

    it("should retry on failure with exponential backoff", async () => {
      let attempts = 0;
      mockCreate.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error("Temporary failure"));
        }
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(Buffer.from("audio").buffer)
        });
      });

      const result = await provider.synthesize({
        text: "Test",
        voice: "alloy"
      });

      expect(result.isOk).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it("should fail after max retries", async () => {
      mockCreate.mockRejectedValue(new Error("Persistent failure"));

      const provider = new OpenAIProvider({ 
        apiKey: "test-key",
        maxRetries: 2
      });

      const result = await provider.synthesize({
        text: "Test",
        voice: "alloy"
      });

      expect(result.isOk).toBe(false);
      expect(mockCreate).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe("getAvailableVoices", () => {
    beforeEach(() => {
      provider = new OpenAIProvider({ apiKey: "test-key" });
    });

    it("should return all available OpenAI voices", async () => {
      const result = await provider.getAvailableVoices();
      
      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toHaveLength(6);
        
        const voiceIds = result.value.map(v => v.id);
        expect(voiceIds).toContain("alloy");
        expect(voiceIds).toContain("echo");
        expect(voiceIds).toContain("fable");
        expect(voiceIds).toContain("onyx");
        expect(voiceIds).toContain("nova");
        expect(voiceIds).toContain("shimmer");

        // Check voice metadata
        const alloy = result.value.find(v => v.id === "alloy");
        expect(alloy).toBeDefined();
        expect(alloy?.provider).toBe("openai");
        expect(alloy?.name).toBe("Alloy");
        expect(alloy?.gender).toBe("neutral");
      }
    });
  });

  describe("rate limiting", () => {
    it("should respect rate limits", async () => {
      const provider = new OpenAIProvider(
        { apiKey: "test-key" },
        { requestsPerMinute: 60, concurrentRequests: 2 }
      );

      mockCreate.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(Buffer.from("audio").buffer)
      });

      const startTime = Date.now();
      
      // Make 3 concurrent requests (should queue the 3rd)
      const promises = [
        provider.synthesize({ text: "Test 1", voice: "alloy" }),
        provider.synthesize({ text: "Test 2", voice: "alloy" }),
        provider.synthesize({ text: "Test 3", voice: "alloy" })
      ];

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // With 60 req/min = 1 req/sec, and concurrent limit of 2
      // The 3rd request should wait for one of the first two to complete
      expect(mockCreate).toHaveBeenCalledTimes(3);
      
      // Duration should be at least 1 second due to rate limiting
      expect(duration).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("streaming", () => {
    beforeEach(() => {
      provider = new OpenAIProvider({ apiKey: "test-key" });
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

      mockCreate.mockResolvedValue(mockStream);

      const result = await provider.synthesizeStream!({
        text: "Stream test",
        voice: "alloy"
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        const collectedChunks: Uint8Array[] = [];
        for await (const chunk of result.value) {
          collectedChunks.push(chunk);
        }
        
        expect(collectedChunks).toHaveLength(3);
        expect(collectedChunks[0]).toEqual(chunks[0]);
        expect(collectedChunks[1]).toEqual(chunks[1]);
        expect(collectedChunks[2]).toEqual(chunks[2]);
      }
    });
  });
});