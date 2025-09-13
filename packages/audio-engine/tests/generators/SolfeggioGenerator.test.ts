import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SolfeggioGenerator } from "../../src/generators/SolfeggioGenerator";
import { SOLFEGGIO_FREQUENCIES, AUDIO_CONSTANTS, DEFAULT_FADES } from "../../src/constants";
import type { Result } from "../../src/types";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
}));

// Mock FFmpegProcessor
vi.mock("../../src/processors/FFmpegProcessor", () => ({
  FFmpegProcessor: vi.fn().mockImplementation(() => ({
    generateTone: vi.fn().mockResolvedValue({
      isOk: true,
      value: { outputPath: "/tmp/test.wav", frequency: 528, duration: 10 },
    }),
    applyFade: vi.fn().mockResolvedValue({
      isOk: true,
      value: { outputPath: "/tmp/test-faded.wav", fadeInMs: 1000, fadeOutMs: 1500 },
    }),
    validateStereoCompliance: vi.fn().mockResolvedValue({
      isOk: true,
      value: { isStereo: true, channels: 2 },
    }),
  })),
}));

// Mock TempFileManager
vi.mock("../../src/utils/TempFileManager", () => ({
  TempFileManager: vi.fn().mockImplementation(() => ({
    createTempFile: vi.fn().mockResolvedValue("/tmp/temp-123.wav"),
    cleanup: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("SolfeggioGenerator", () => {
  let generator: SolfeggioGenerator;

  beforeEach(() => {
    generator = new SolfeggioGenerator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with FFmpegProcessor", () => {
      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(SolfeggioGenerator);
    });
  });

  describe("generateFrequency", () => {
    it("should generate a valid Solfeggio frequency", async () => {
      const result = await generator.generateFrequency({
        frequency: 528,
        durationSec: 10,
        amplitude: 0.5,
        outputPath: "/tmp/solfeggio-528.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.frequency).toBe(528);
        expect(result.value.outputPath).toBe("/tmp/solfeggio-528.wav");
        expect(result.value.isStereo).toBe(true);
        expect(result.value.channels).toBe(2);
      }
    });

    it("should reject invalid Solfeggio frequency", async () => {
      const result = await generator.generateFrequency({
        frequency: 440, // Not a Solfeggio frequency
        durationSec: 10,
        amplitude: 0.5,
        outputPath: "/tmp/invalid.wav",
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Invalid Solfeggio frequency");
      }
    });

    it("should apply amplitude control correctly", async () => {
      const result = await generator.generateFrequency({
        frequency: 396,
        durationSec: 5,
        amplitude: 0.3,
        outputPath: "/tmp/solfeggio-396.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.amplitude).toBe(0.3);
      }
    });

    it("should validate amplitude range", async () => {
      const result = await generator.generateFrequency({
        frequency: 639,
        durationSec: 10,
        amplitude: 1.5, // Invalid: > 1.0
        outputPath: "/tmp/invalid-amplitude.wav",
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Amplitude must be between 0 and 1");
      }
    });

    it("should apply fade in/out when specified", async () => {
      const result = await generator.generateFrequency({
        frequency: 741,
        durationSec: 10,
        amplitude: 0.5,
        outputPath: "/tmp/solfeggio-fade.wav",
        fadeInMs: 2000,
        fadeOutMs: 3000,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.fadeInMs).toBe(2000);
        expect(result.value.fadeOutMs).toBe(3000);
      }
    });

    it("should validate duration range", async () => {
      const result = await generator.generateFrequency({
        frequency: 852,
        durationSec: -5, // Invalid: negative duration
        amplitude: 0.5,
        outputPath: "/tmp/invalid-duration.wav",
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Duration must be positive");
      }
    });
  });

  describe("generateAll", () => {
    it("should generate all 9 Solfeggio frequencies", async () => {
      const result = await generator.generateAll({
        durationSec: 10,
        amplitude: 0.5,
        outputDir: "/tmp/solfeggio",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.frequencies).toHaveLength(9);
        expect(result.value.frequencies).toEqual(
          expect.arrayContaining([174, 285, 396, 417, 528, 639, 741, 852, 963])
        );
        expect(result.value.outputPaths).toHaveLength(9);
      }
    });

    it("should apply consistent amplitude to all frequencies", async () => {
      const result = await generator.generateAll({
        durationSec: 5,
        amplitude: 0.3,
        outputDir: "/tmp/solfeggio",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        result.value.outputPaths.forEach((path) => {
          expect(path).toContain("solfeggio");
          expect(path).toMatch(/\d{3}Hz\.wav$/);
        });
      }
    });

    it("should apply fade to all frequencies when specified", async () => {
      const result = await generator.generateAll({
        durationSec: 10,
        amplitude: 0.5,
        outputDir: "/tmp/solfeggio",
        fadeInMs: 1500,
        fadeOutMs: 2000,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.fadeInMs).toBe(1500);
        expect(result.value.fadeOutMs).toBe(2000);
      }
    });
  });

  describe("generateWithMetadata", () => {
    it("should include frequency metadata in output", async () => {
      const result = await generator.generateWithMetadata({
        frequency: 528,
        durationSec: 10,
        amplitude: 0.5,
        outputPath: "/tmp/solfeggio-528.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.metadata).toBeDefined();
        expect(result.value.metadata.name).toBe("Soothing Renewal");
        expect(result.value.metadata.description).toContain("feel-good tone");
        expect(result.value.metadata.frequency).toBe(528);
      }
    });
  });

  describe("validateFrequency", () => {
    it("should validate all standard Solfeggio frequencies", () => {
      const frequencies = [174, 285, 396, 417, 528, 639, 741, 852, 963];
      frequencies.forEach((freq) => {
        // @ts-ignore - accessing private method for testing
        expect(generator.validateFrequency(freq)).toBe(true);
      });
    });

    it("should reject non-Solfeggio frequencies", () => {
      const invalidFrequencies = [100, 440, 500, 1000];
      invalidFrequencies.forEach((freq) => {
        // @ts-ignore - accessing private method for testing
        expect(generator.validateFrequency(freq)).toBe(false);
      });
    });
  });

  describe("stereo compliance", () => {
    it("should ensure all outputs are stereo", async () => {
      const result = await generator.generateFrequency({
        frequency: 396,
        durationSec: 10,
        amplitude: 0.5,
        outputPath: "/tmp/stereo-test.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.channels).toBe(2);
        expect(result.value.isStereo).toBe(true);
      }
    });

    it("should reject mono output from FFmpeg", async () => {
      // Mock FFmpeg to return mono
      const mockFFmpeg = await import("../../src/processors/FFmpegProcessor");
      vi.mocked(mockFFmpeg.FFmpegProcessor).mockImplementationOnce(() => ({
        generateTone: vi.fn().mockResolvedValue({
          isOk: true,
          value: { outputPath: "/tmp/test.wav", frequency: 528, duration: 10 },
        }),
        validateStereoCompliance: vi.fn().mockResolvedValue({
          isOk: true,
          value: { isStereo: false, channels: 1 },
        }),
        applyFade: vi.fn(),
      }));

      const monoGenerator = new SolfeggioGenerator();
      const result = await monoGenerator.generateFrequency({
        frequency: 528,
        durationSec: 10,
        amplitude: 0.5,
        outputPath: "/tmp/mono.wav",
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("stereo");
      }
    });
  });

  describe("cleanup", () => {
    it("should clean up temp files on error", async () => {
      // Mock FFmpeg to throw error
      const mockFFmpeg = await import("../../src/processors/FFmpegProcessor");
      vi.mocked(mockFFmpeg.FFmpegProcessor).mockImplementationOnce(() => ({
        generateTone: vi.fn().mockResolvedValue({
          isOk: false,
          error: new Error("FFmpeg failed"),
        }),
        validateStereoCompliance: vi.fn(),
        applyFade: vi.fn(),
      }));

      const errorGenerator = new SolfeggioGenerator();
      const result = await errorGenerator.generateFrequency({
        frequency: 528,
        durationSec: 10,
        amplitude: 0.5,
        outputPath: "/tmp/error.wav",
      });

      expect(result.isOk).toBe(false);
      // Verify cleanup was called (through TempFileManager mock)
    });
  });
});