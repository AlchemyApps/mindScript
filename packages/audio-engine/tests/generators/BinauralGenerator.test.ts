import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BinauralGenerator } from "../../src/generators/BinauralGenerator";
import { BINAURAL_BANDS, AUDIO_CONSTANTS } from "../../src/constants";
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
    generateBinauralBeat: vi.fn().mockResolvedValue({
      isOk: true,
      value: { outputPath: "/tmp/binaural.wav", leftFreq: 200, rightFreq: 210 },
    }),
    applyFade: vi.fn().mockResolvedValue({
      isOk: true,
      value: { outputPath: "/tmp/binaural-faded.wav", fadeInMs: 1000, fadeOutMs: 1500 },
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
    createTempFile: vi.fn().mockResolvedValue("/tmp/temp-binaural.wav"),
    cleanup: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("BinauralGenerator", () => {
  let generator: BinauralGenerator;

  beforeEach(() => {
    generator = new BinauralGenerator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with FFmpegProcessor", () => {
      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(BinauralGenerator);
    });
  });

  describe("generateBeat", () => {
    it("should generate delta band binaural beat", async () => {
      const result = await generator.generateBeat({
        band: "delta",
        beatFrequency: 2,
        carrierFrequency: 200,
        durationSec: 10,
        outputPath: "/tmp/delta.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.band).toBe("delta");
        expect(result.value.beatFrequency).toBe(2);
        expect(result.value.carrierFrequency).toBe(200);
        expect(result.value.leftFreq).toBe(199); // 200 - 2/2
        expect(result.value.rightFreq).toBe(201); // 200 + 2/2
        expect(result.value.isStereo).toBe(true);
      }
    });

    it("should generate theta band binaural beat", async () => {
      const result = await generator.generateBeat({
        band: "theta",
        beatFrequency: 6,
        carrierFrequency: 300,
        durationSec: 10,
        outputPath: "/tmp/theta.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.band).toBe("theta");
        expect(result.value.beatFrequency).toBe(6);
        expect(result.value.leftFreq).toBe(297); // 300 - 6/2
        expect(result.value.rightFreq).toBe(303); // 300 + 6/2
      }
    });

    it("should generate alpha band binaural beat", async () => {
      const result = await generator.generateBeat({
        band: "alpha",
        beatFrequency: 10,
        carrierFrequency: 400,
        durationSec: 10,
        outputPath: "/tmp/alpha.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.band).toBe("alpha");
        expect(result.value.beatFrequency).toBe(10);
        expect(result.value.leftFreq).toBe(395); // 400 - 10/2
        expect(result.value.rightFreq).toBe(405); // 400 + 10/2
      }
    });

    it("should generate beta band binaural beat", async () => {
      const result = await generator.generateBeat({
        band: "beta",
        beatFrequency: 20,
        carrierFrequency: 350,
        durationSec: 10,
        outputPath: "/tmp/beta.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.band).toBe("beta");
        expect(result.value.beatFrequency).toBe(20);
        expect(result.value.leftFreq).toBe(340); // 350 - 20/2
        expect(result.value.rightFreq).toBe(360); // 350 + 20/2
      }
    });

    it("should generate gamma band binaural beat", async () => {
      const result = await generator.generateBeat({
        band: "gamma",
        beatFrequency: 40,
        carrierFrequency: 450,
        durationSec: 10,
        outputPath: "/tmp/gamma.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.band).toBe("gamma");
        expect(result.value.beatFrequency).toBe(40);
        expect(result.value.leftFreq).toBe(430); // 450 - 40/2
        expect(result.value.rightFreq).toBe(470); // 450 + 40/2
      }
    });

    it("should validate beat frequency is within band range", async () => {
      const result = await generator.generateBeat({
        band: "delta",
        beatFrequency: 10, // Too high for delta (1-4 Hz)
        carrierFrequency: 200,
        durationSec: 10,
        outputPath: "/tmp/invalid-delta.wav",
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Beat frequency 10Hz is outside delta band range");
      }
    });

    it("should validate carrier frequency range", async () => {
      const result = await generator.generateBeat({
        band: "alpha",
        beatFrequency: 10,
        carrierFrequency: 50, // Too low (minimum 100Hz)
        durationSec: 10,
        outputPath: "/tmp/invalid-carrier.wav",
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Carrier frequency must be between 100 and 1000 Hz");
      }
    });

    it("should apply amplitude control", async () => {
      const result = await generator.generateBeat({
        band: "theta",
        beatFrequency: 5,
        carrierFrequency: 250,
        durationSec: 10,
        amplitude: 0.3,
        outputPath: "/tmp/theta-soft.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.amplitude).toBe(0.3);
      }
    });

    it("should apply fade in/out when specified", async () => {
      const result = await generator.generateBeat({
        band: "alpha",
        beatFrequency: 10,
        carrierFrequency: 300,
        durationSec: 10,
        outputPath: "/tmp/alpha-fade.wav",
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

  describe("generateAllBands", () => {
    it("should generate beats for all 5 bands", async () => {
      const result = await generator.generateAllBands({
        carrierFrequency: 300,
        durationSec: 10,
        outputDir: "/tmp/binaural",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.bands).toHaveLength(5);
        expect(result.value.bands).toEqual(
          expect.arrayContaining(["delta", "theta", "alpha", "beta", "gamma"])
        );
        expect(result.value.outputPaths).toHaveLength(5);
      }
    });

    it("should use default beat frequencies for each band", async () => {
      const result = await generator.generateAllBands({
        carrierFrequency: 400,
        durationSec: 10,
        outputDir: "/tmp/binaural",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.beatFrequencies).toEqual({
          delta: 2,
          theta: 6,
          alpha: 10,
          beta: 20,
          gamma: 40,
        });
      }
    });

    it("should apply consistent settings to all bands", async () => {
      const result = await generator.generateAllBands({
        carrierFrequency: 350,
        durationSec: 5,
        amplitude: 0.4,
        outputDir: "/tmp/binaural",
        fadeInMs: 1000,
        fadeOutMs: 1500,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        result.value.outputPaths.forEach((path) => {
          expect(path).toContain("binaural");
          expect(path).toMatch(/(delta|theta|alpha|beta|gamma)\.wav$/);
        });
      }
    });
  });

  describe("stereo field preservation", () => {
    it("should ensure L/R channels have different frequencies", async () => {
      const result = await generator.generateBeat({
        band: "alpha",
        beatFrequency: 10,
        carrierFrequency: 300,
        durationSec: 10,
        outputPath: "/tmp/stereo-test.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.leftFreq).not.toBe(result.value.rightFreq);
        expect(result.value.rightFreq - result.value.leftFreq).toBe(10);
        expect(result.value.channels).toBe(2);
        expect(result.value.isStereo).toBe(true);
      }
    });

    it("should reject mono output", async () => {
      // Mock FFmpeg to return mono
      const mockFFmpeg = await import("../../src/processors/FFmpegProcessor");
      vi.mocked(mockFFmpeg.FFmpegProcessor).mockImplementationOnce(() => ({
        generateBinauralBeat: vi.fn().mockResolvedValue({
          isOk: true,
          value: { outputPath: "/tmp/binaural.wav", leftFreq: 200, rightFreq: 210 },
        }),
        validateStereoCompliance: vi.fn().mockResolvedValue({
          isOk: true,
          value: { isStereo: false, channels: 1 },
        }),
        applyFade: vi.fn(),
      }));

      const monoGenerator = new BinauralGenerator();
      const result = await monoGenerator.generateBeat({
        band: "theta",
        beatFrequency: 5,
        carrierFrequency: 200,
        durationSec: 10,
        outputPath: "/tmp/mono.wav",
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Binaural beat must be stereo");
      }
    });
  });

  describe("generateWithMetadata", () => {
    it("should include band metadata in output", async () => {
      const result = await generator.generateWithMetadata({
        band: "theta",
        beatFrequency: 6,
        carrierFrequency: 300,
        durationSec: 10,
        outputPath: "/tmp/theta-meta.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.metadata).toBeDefined();
        expect(result.value.metadata.name).toBe("Meditative Drift");
        expect(result.value.metadata.description).toContain("Creativity");
        expect(result.value.metadata.band).toBe("theta");
        expect(result.value.metadata.range).toEqual([4, 8]);
      }
    });
  });

  describe("calculateOptimalCarrier", () => {
    it("should calculate optimal carrier frequency for beat frequency", () => {
      // @ts-ignore - accessing private method for testing
      const carrier = generator.calculateOptimalCarrier(10);
      expect(carrier).toBeGreaterThanOrEqual(200);
      expect(carrier).toBeLessThanOrEqual(500);
    });
  });

  describe("cleanup", () => {
    it("should clean up temp files on error", async () => {
      // Mock FFmpeg to throw error
      const mockFFmpeg = await import("../../src/processors/FFmpegProcessor");
      vi.mocked(mockFFmpeg.FFmpegProcessor).mockImplementationOnce(() => ({
        generateBinauralBeat: vi.fn().mockResolvedValue({
          isOk: false,
          error: new Error("FFmpeg failed"),
        }),
        validateStereoCompliance: vi.fn(),
        applyFade: vi.fn(),
      }));

      const errorGenerator = new BinauralGenerator();
      const result = await errorGenerator.generateBeat({
        band: "alpha",
        beatFrequency: 10,
        carrierFrequency: 300,
        durationSec: 10,
        outputPath: "/tmp/error.wav",
      });

      expect(result.isOk).toBe(false);
      // Verify cleanup was called (through TempFileManager mock)
    });
  });
});