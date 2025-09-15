import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ElevenLabsVoiceCloning } from "./ElevenLabsCloning";
import type { VoiceCloneRequest, VoiceConsent } from "@mindscript/schemas";

// Mock the ElevenLabs SDK
vi.mock("elevenlabs", () => ({
  ElevenLabsClient: vi.fn().mockImplementation(() => ({
    voices: {
      add: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(),
    },
    textToSpeech: {
      convert: vi.fn(),
    },
  })),
}));

describe("ElevenLabsVoiceCloning", () => {
  let provider: ElevenLabsVoiceCloning;
  let mockClient: any;

  beforeEach(() => {
    // Clear environment variables
    process.env.ELEVENLABS_API_KEY = "test-api-key";

    provider = new ElevenLabsVoiceCloning({
      apiKey: "test-api-key",
    });

    // Get the mocked client
    mockClient = (provider as any).client;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("cloneVoice", () => {
    it("should successfully clone a voice with valid input", async () => {
      const mockVoiceId = "test-voice-id-123";
      const mockAudioBuffer = Buffer.from("test-audio-data");

      mockClient.voices.add.mockResolvedValue({
        voice_id: mockVoiceId,
      });

      const request: VoiceCloneRequest = {
        name: "Test Voice",
        description: "A test voice for meditation",
        uploadData: {
          fileName: "test.mp3",
          fileSize: 2048000,
          mimeType: "audio/mpeg",
          duration: 120,
          sampleRate: 44100,
          bitrate: 128000,
        },
        consent: createValidConsent(),
        labels: {
          accent: "american",
          age: "middle",
          gender: "neutral",
        },
      };

      const result = await provider.cloneVoice(request, mockAudioBuffer);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.success).toBe(true);
        expect(result.value.voiceId).toBe(mockVoiceId);
      }

      expect(mockClient.voices.add).toHaveBeenCalledWith({
        name: "Test Voice",
        description: "A test voice for meditation",
        files: [mockAudioBuffer],
        labels: {
          accent: "american",
          age: "middle",
          gender: "neutral",
        },
      });
    });

    it("should handle API errors gracefully", async () => {
      mockClient.voices.add.mockRejectedValue(new Error("API Error: Rate limit exceeded"));

      const request: VoiceCloneRequest = {
        name: "Test Voice",
        uploadData: {
          fileName: "test.mp3",
          fileSize: 2048000,
          mimeType: "audio/mpeg",
          duration: 120,
          sampleRate: 44100,
          bitrate: 128000,
        },
        consent: createValidConsent(),
      };

      const result = await provider.cloneVoice(request, Buffer.from("test"));

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Rate limit exceeded");
      }
    });

    it("should validate consent before processing", async () => {
      const invalidConsent: VoiceConsent = {
        hasConsent: true,
        isOver18: false, // Invalid - must be 18+
        acceptsTerms: true,
        ownsVoice: true,
        understandsUsage: true,
        noImpersonation: true,
        timestamp: new Date().toISOString(),
      };

      const request: VoiceCloneRequest = {
        name: "Test Voice",
        uploadData: {
          fileName: "test.mp3",
          fileSize: 2048000,
          mimeType: "audio/mpeg",
          duration: 120,
          sampleRate: 44100,
          bitrate: 128000,
        },
        consent: invalidConsent,
      };

      const result = await provider.cloneVoice(request, Buffer.from("test"));

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("18");
      }
    });

    it("should validate audio requirements", async () => {
      const request: VoiceCloneRequest = {
        name: "Test Voice",
        uploadData: {
          fileName: "test.mp3",
          fileSize: 11000000, // Too large
          mimeType: "audio/mpeg",
          duration: 120,
          sampleRate: 44100,
          bitrate: 128000,
        },
        consent: createValidConsent(),
      };

      const result = await provider.cloneVoice(request, Buffer.from("test"));

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("10MB");
      }
    });
  });

  describe("deleteVoice", () => {
    it("should successfully delete a voice", async () => {
      mockClient.voices.delete.mockResolvedValue({ success: true });

      const result = await provider.deleteVoice("test-voice-id");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(true);
      }

      expect(mockClient.voices.delete).toHaveBeenCalledWith("test-voice-id");
    });

    it("should handle deletion errors", async () => {
      mockClient.voices.delete.mockRejectedValue(new Error("Voice not found"));

      const result = await provider.deleteVoice("non-existent-voice");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Voice not found");
      }
    });
  });

  describe("getVoiceDetails", () => {
    it("should retrieve voice details", async () => {
      const mockVoice = {
        voice_id: "test-voice-id",
        name: "Test Voice",
        description: "A test voice",
        labels: {
          accent: "american",
          age: "middle",
          gender: "neutral",
        },
        samples: [],
      };

      mockClient.voices.get.mockResolvedValue(mockVoice);

      const result = await provider.getVoiceDetails("test-voice-id");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.voice_id).toBe("test-voice-id");
        expect(result.value.name).toBe("Test Voice");
      }

      expect(mockClient.voices.get).toHaveBeenCalledWith("test-voice-id");
    });

    it("should handle voice not found", async () => {
      mockClient.voices.get.mockRejectedValue(new Error("Voice not found"));

      const result = await provider.getVoiceDetails("non-existent");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Voice not found");
      }
    });
  });

  describe("previewVoice", () => {
    it("should generate preview audio for a voice", async () => {
      const mockAudioBuffer = Buffer.from("preview-audio-data");

      mockClient.textToSpeech.convert.mockResolvedValue(mockAudioBuffer);

      const result = await provider.previewVoice(
        "test-voice-id",
        "This is a preview of the cloned voice."
      );

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBeInstanceOf(Buffer);
        expect(result.value.toString()).toBe("preview-audio-data");
      }

      expect(mockClient.textToSpeech.convert).toHaveBeenCalledWith(
        "test-voice-id",
        expect.objectContaining({
          text: "This is a preview of the cloned voice.",
          model_id: "eleven_monolingual_v1",
        })
      );
    });

    it("should limit preview text length", async () => {
      const longText = "a".repeat(600); // Exceeds 500 char limit
      mockClient.textToSpeech.convert.mockResolvedValue(Buffer.from("preview"));

      const result = await provider.previewVoice("test-voice-id", longText);

      expect(result.isOk).toBe(true);

      // Check that text was truncated
      const callArgs = mockClient.textToSpeech.convert.mock.calls[0][1];
      expect(callArgs.text.length).toBeLessThanOrEqual(500);
    });

    it("should handle preview generation errors", async () => {
      mockClient.textToSpeech.convert.mockRejectedValue(new Error("TTS failed"));

      const result = await provider.previewVoice("test-voice-id", "Preview text");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("TTS failed");
      }
    });
  });

  describe("validateAudioFile", () => {
    it("should validate valid audio buffer", async () => {
      // Mock a valid MP3 buffer with ID3 header
      const validMp3Buffer = Buffer.from([
        0x49, 0x44, 0x33, // ID3
        0x03, 0x00, // Version
        0x00, // Flags
        0x00, 0x00, 0x00, 0x00, // Size
      ]);

      const result = await provider.validateAudioFile(validMp3Buffer, {
        fileName: "test.mp3",
        fileSize: validMp3Buffer.length,
        mimeType: "audio/mpeg",
        duration: 120,
        sampleRate: 44100,
        bitrate: 128000,
      });

      expect(result.isOk).toBe(true);
    });

    it("should reject invalid audio format", async () => {
      const invalidBuffer = Buffer.from("not-audio-data");

      const result = await provider.validateAudioFile(invalidBuffer, {
        fileName: "test.txt",
        fileSize: invalidBuffer.length,
        mimeType: "text/plain",
        duration: 120,
        sampleRate: 44100,
        bitrate: 128000,
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Invalid audio format");
      }
    });

    it("should reject audio that's too short", async () => {
      const validMp3Buffer = Buffer.from([0x49, 0x44, 0x33]);

      const result = await provider.validateAudioFile(validMp3Buffer, {
        fileName: "test.mp3",
        fileSize: validMp3Buffer.length,
        mimeType: "audio/mpeg",
        duration: 30, // Too short
        sampleRate: 44100,
        bitrate: 128000,
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("60 seconds");
      }
    });
  });

  describe("getUserVoices", () => {
    it("should retrieve all user voices", async () => {
      const mockVoices = {
        voices: [
          {
            voice_id: "voice1",
            name: "Voice 1",
            description: "First voice",
            category: "cloned",
          },
          {
            voice_id: "voice2",
            name: "Voice 2",
            description: "Second voice",
            category: "cloned",
          },
        ],
      };

      mockClient.voices.getAll.mockResolvedValue(mockVoices);

      const result = await provider.getUserVoices();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].voice_id).toBe("voice1");
      }
    });

    it("should filter only cloned voices", async () => {
      const mockVoices = {
        voices: [
          {
            voice_id: "voice1",
            name: "Voice 1",
            category: "cloned",
          },
          {
            voice_id: "voice2",
            name: "Voice 2",
            category: "premade", // Not a cloned voice
          },
          {
            voice_id: "voice3",
            name: "Voice 3",
            category: "cloned",
          },
        ],
      };

      mockClient.voices.getAll.mockResolvedValue(mockVoices);

      const result = await provider.getUserVoices();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toHaveLength(2);
        expect(result.value.every(v => v.category === "cloned")).toBe(true);
      }
    });
  });
});

// Helper function to create valid consent
function createValidConsent(): VoiceConsent {
  return {
    hasConsent: true,
    isOver18: true,
    acceptsTerms: true,
    ownsVoice: true,
    understandsUsage: true,
    noImpersonation: true,
    timestamp: new Date().toISOString(),
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
  };
}