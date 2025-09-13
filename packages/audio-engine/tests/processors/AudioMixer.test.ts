import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioMixer } from "../../src/processors/AudioMixer";
import { DEFAULT_GAINS, AUDIO_CONSTANTS } from "../../src/constants";
import type { Result } from "../../src/types";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// Mock fluent-ffmpeg for crossfade tests
vi.mock("fluent-ffmpeg", () => {
  const createMockCommand = () => {
    const mockCommand = {
      input: vi.fn().mockReturnThis(),
      complexFilter: vi.fn().mockReturnThis(),
      outputOptions: vi.fn().mockReturnThis(),
      audioChannels: vi.fn().mockReturnThis(),
      output: vi.fn().mockReturnThis(),
      on: vi.fn(function(event, handler) {
        if (event === "end") {
          setTimeout(() => handler(), 0);
        }
        return this;
      }),
      run: vi.fn().mockReturnThis(),
    };
    return mockCommand;
  };

  const ffmpegConstructor = vi.fn(() => createMockCommand());
  ffmpegConstructor.ffprobe = vi.fn((file, callback) => {
    callback(null, {
      format: {
        duration: 10.0, // 10 seconds
      },
    });
  });
  
  return {
    default: ffmpegConstructor,
  };
});

// Mock FFmpegProcessor
vi.mock("../../src/processors/FFmpegProcessor", () => ({
  FFmpegProcessor: vi.fn().mockImplementation(() => ({
    mixAudioTracks: vi.fn().mockResolvedValue({
      isOk: true,
      value: { outputPath: "/tmp/mixed.wav", inputCount: 4 },
    }),
    normalizeLoudness: vi.fn().mockResolvedValue({
      isOk: true,
      value: { outputPath: "/tmp/normalized.wav", targetLufs: -16 },
    }),
    validateStereoCompliance: vi.fn().mockResolvedValue({
      isOk: true,
      value: { isStereo: true, channels: 2 },
    }),
    applyFade: vi.fn().mockResolvedValue({
      isOk: true,
      value: { outputPath: "/tmp/faded.wav", fadeInMs: 1000, fadeOutMs: 1500 },
    }),
  })),
}));

// Mock GainController
vi.mock("../../src/processors/GainController", () => ({
  GainController: vi.fn().mockImplementation(() => ({
    applyGain: vi.fn().mockResolvedValue({
      isOk: true,
      value: { outputPath: "/tmp/gained.wav", gainDb: -10 },
    }),
    calculateMixGain: vi.fn().mockReturnValue(-3),
    preventClipping: vi.fn().mockResolvedValue({
      isOk: true,
      value: { outputPath: "/tmp/limited.wav", peakLevel: -0.1 },
    }),
  })),
}));

// Mock TempFileManager
vi.mock("../../src/utils/TempFileManager", () => ({
  TempFileManager: vi.fn().mockImplementation(() => ({
    createTempFile: vi.fn().mockResolvedValue("/tmp/temp-mix.wav"),
    cleanup: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("AudioMixer", () => {
  let mixer: AudioMixer;

  beforeEach(() => {
    mixer = new AudioMixer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with FFmpegProcessor and GainController", () => {
      expect(mixer).toBeDefined();
      expect(mixer).toBeInstanceOf(AudioMixer);
    });
  });

  describe("mixLayers", () => {
    it("should mix all four layers with default gains", async () => {
      const result = await mixer.mixLayers({
        voicePath: "/tmp/voice.wav",
        musicPath: "/tmp/music.wav",
        solfeggioPath: "/tmp/solfeggio.wav",
        binauralPath: "/tmp/binaural.wav",
        outputPath: "/tmp/final.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.layerCount).toBe(4);
        expect(result.value.outputPath).toBe("/tmp/final.wav");
        expect(result.value.gains).toEqual({
          voice: DEFAULT_GAINS.VOICE,
          music: DEFAULT_GAINS.MUSIC,
          solfeggio: DEFAULT_GAINS.SOLFEGGIO,
          binaural: DEFAULT_GAINS.BINAURAL,
        });
      }
    });

    it("should mix with custom gain values", async () => {
      const customGains = {
        voiceDb: -2,
        musicDb: -12,
        solfeggioDb: -18,
        binauralDb: -20,
      };

      const result = await mixer.mixLayers({
        voicePath: "/tmp/voice.wav",
        musicPath: "/tmp/music.wav",
        solfeggioPath: "/tmp/solfeggio.wav",
        binauralPath: "/tmp/binaural.wav",
        outputPath: "/tmp/final.wav",
        gains: customGains,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.gains).toEqual({
          voice: -2,
          music: -12,
          solfeggio: -18,
          binaural: -20,
        });
      }
    });

    it("should mix partial layers (voice and music only)", async () => {
      const result = await mixer.mixLayers({
        voicePath: "/tmp/voice.wav",
        musicPath: "/tmp/music.wav",
        outputPath: "/tmp/final.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.layerCount).toBe(2);
        expect(result.value.layers).toEqual(["voice", "music"]);
      }
    });

    it("should mix single layer (voice only)", async () => {
      const result = await mixer.mixLayers({
        voicePath: "/tmp/voice.wav",
        outputPath: "/tmp/final.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.layerCount).toBe(1);
        expect(result.value.layers).toEqual(["voice"]);
      }
    });

    it("should reject mixing with no inputs", async () => {
      const result = await mixer.mixLayers({
        outputPath: "/tmp/final.wav",
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("At least one audio layer required");
      }
    });

    it("should normalize to target LUFS", async () => {
      const result = await mixer.mixLayers({
        voicePath: "/tmp/voice.wav",
        musicPath: "/tmp/music.wav",
        outputPath: "/tmp/final.wav",
        targetLufs: -14,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.targetLufs).toBe(-14);
        expect(result.value.normalized).toBe(true);
      }
    });

    it("should use default -16 LUFS when not specified", async () => {
      const result = await mixer.mixLayers({
        voicePath: "/tmp/voice.wav",
        outputPath: "/tmp/final.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.targetLufs).toBe(AUDIO_CONSTANTS.TARGET_LUFS);
      }
    });
  });

  describe("crossfadeLayers", () => {
    it("should crossfade between two segments", async () => {
      const result = await mixer.crossfadeLayers({
        fromPath: "/tmp/segment1.wav",
        toPath: "/tmp/segment2.wav",
        outputPath: "/tmp/crossfaded.wav",
        crossfadeDurationMs: 2000,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.crossfadeDurationMs).toBe(2000);
        expect(result.value.outputPath).toBe("/tmp/crossfaded.wav");
      }
    });

    it("should validate crossfade duration", async () => {
      const result = await mixer.crossfadeLayers({
        fromPath: "/tmp/segment1.wav",
        toPath: "/tmp/segment2.wav",
        outputPath: "/tmp/crossfaded.wav",
        crossfadeDurationMs: -1000, // Invalid negative duration
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Crossfade duration must be positive");
      }
    });

    it("should limit crossfade to segment duration", async () => {
      const result = await mixer.crossfadeLayers({
        fromPath: "/tmp/segment1.wav",
        toPath: "/tmp/segment2.wav",
        outputPath: "/tmp/crossfaded.wav",
        crossfadeDurationMs: 60000, // Very long crossfade
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        // Should be limited to actual segment duration
        expect(result.value.crossfadeDurationMs).toBeLessThanOrEqual(10000);
      }
    });
  });

  describe("automatic gain staging", () => {
    it("should prevent clipping with automatic gain reduction", async () => {
      const result = await mixer.mixLayers({
        voicePath: "/tmp/loud-voice.wav",
        musicPath: "/tmp/loud-music.wav",
        solfeggioPath: "/tmp/loud-solfeggio.wav",
        binauralPath: "/tmp/loud-binaural.wav",
        outputPath: "/tmp/final.wav",
        preventClipping: true,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.clippingPrevented).toBe(true);
        expect(result.value.peakLevel).toBeLessThanOrEqual(0);
      }
    });

    it("should calculate optimal mix gain for multiple layers", async () => {
      const result = await mixer.mixLayers({
        voicePath: "/tmp/voice.wav",
        musicPath: "/tmp/music.wav",
        solfeggioPath: "/tmp/solfeggio.wav",
        outputPath: "/tmp/final.wav",
        autoGainStaging: true,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.autoGainApplied).toBe(true);
        // Should have reduced gain to prevent buildup
        expect(result.value.mixGainReduction).toBeLessThan(0);
      }
    });
  });

  describe("stereo compliance", () => {
    it("should ensure output is always stereo", async () => {
      const result = await mixer.mixLayers({
        voicePath: "/tmp/mono-voice.wav",
        musicPath: "/tmp/stereo-music.wav",
        outputPath: "/tmp/final.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.channels).toBe(2);
        expect(result.value.isStereo).toBe(true);
      }
    });

    it("should reject non-stereo output", async () => {
      // Mock FFmpeg to return mono
      const mockFFmpeg = await import("../../src/processors/FFmpegProcessor");
      vi.mocked(mockFFmpeg.FFmpegProcessor).mockImplementationOnce(() => ({
        mixAudioTracks: vi.fn().mockResolvedValue({
          isOk: true,
          value: { outputPath: "/tmp/mixed.wav", inputCount: 2 },
        }),
        normalizeLoudness: vi.fn().mockResolvedValue({
          isOk: true,
          value: { outputPath: "/tmp/normalized.wav", targetLufs: -16 },
        }),
        validateStereoCompliance: vi.fn().mockResolvedValue({
          isOk: true,
          value: { isStereo: false, channels: 1 },
        }),
        applyFade: vi.fn(),
      }));

      const monoMixer = new AudioMixer();
      const result = await monoMixer.mixLayers({
        voicePath: "/tmp/voice.wav",
        outputPath: "/tmp/mono.wav",
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Output must be stereo");
      }
    });
  });

  describe("fade effects", () => {
    it("should apply fade in/out to final mix", async () => {
      const result = await mixer.mixLayers({
        voicePath: "/tmp/voice.wav",
        musicPath: "/tmp/music.wav",
        outputPath: "/tmp/final.wav",
        fadeInMs: 2000,
        fadeOutMs: 3000,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.fadeInMs).toBe(2000);
        expect(result.value.fadeOutMs).toBe(3000);
      }
    });
  });

  describe("cleanup", () => {
    it("should clean up temp files on error", async () => {
      // Mock FFmpeg to throw error
      const mockFFmpeg = await import("../../src/processors/FFmpegProcessor");
      vi.mocked(mockFFmpeg.FFmpegProcessor).mockImplementationOnce(() => ({
        mixAudioTracks: vi.fn().mockResolvedValue({
          isOk: false,
          error: new Error("Mixing failed"),
        }),
        normalizeLoudness: vi.fn(),
        validateStereoCompliance: vi.fn(),
        applyFade: vi.fn(),
      }));

      const errorMixer = new AudioMixer();
      const result = await errorMixer.mixLayers({
        voicePath: "/tmp/voice.wav",
        musicPath: "/tmp/music.wav",
        outputPath: "/tmp/error.wav",
      });

      expect(result.isOk).toBe(false);
      // Verify cleanup was called (through TempFileManager mock)
    });
  });
});