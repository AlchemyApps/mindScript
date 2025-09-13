import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GainController } from "../../src/processors/GainController";
import type { Result } from "../../src/types";

// Mock FFmpegProcessor
vi.mock("../../src/processors/FFmpegProcessor", () => ({
  FFmpegProcessor: vi.fn().mockImplementation(() => ({
    // Mock methods will be overridden in specific tests
  })),
}));

// Mock fluent-ffmpeg
vi.mock("fluent-ffmpeg", () => {
  const createMockCommand = () => {
    const mockCommand = {
      audioFilters: vi.fn().mockReturnThis(),
      audioChannels: vi.fn().mockReturnThis(),
      output: vi.fn().mockReturnThis(),
      format: vi.fn().mockReturnThis(),
      on: vi.fn(function(event, handler) {
        if (event === "end") {
          setTimeout(() => handler(), 0);
        } else if (event === "stderr") {
          // Simulate stderr output for measurements
          setTimeout(() => handler("Mock stderr output"), 0);
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
        duration: 10.5,
      },
      streams: [
        {
          codec_type: "audio",
          channels: 2,
        },
      ],
    });
  });
  
  return {
    default: ffmpegConstructor,
  };
});

describe("GainController", () => {
  let controller: GainController;

  beforeEach(() => {
    controller = new GainController();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create instance", () => {
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(GainController);
    });
  });

  describe("dbToLinear", () => {
    it("should convert 0 dB to 1.0 linear", () => {
      expect(controller.dbToLinear(0)).toBe(1);
    });

    it("should convert -6 dB to approximately 0.5 linear", () => {
      const result = controller.dbToLinear(-6);
      expect(result).toBeCloseTo(0.501, 2);
    });

    it("should convert -20 dB to 0.1 linear", () => {
      const result = controller.dbToLinear(-20);
      expect(result).toBeCloseTo(0.1, 2);
    });

    it("should convert +6 dB to approximately 2.0 linear", () => {
      const result = controller.dbToLinear(6);
      expect(result).toBeCloseTo(1.995, 2);
    });

    it("should handle negative infinity as silence", () => {
      const result = controller.dbToLinear(-Infinity);
      expect(result).toBe(0);
    });
  });

  describe("linearToDb", () => {
    it("should convert 1.0 linear to 0 dB", () => {
      expect(controller.linearToDb(1)).toBe(0);
    });

    it("should convert 0.5 linear to approximately -6 dB", () => {
      const result = controller.linearToDb(0.5);
      expect(result).toBeCloseTo(-6.02, 1);
    });

    it("should convert 0.1 linear to -20 dB", () => {
      const result = controller.linearToDb(0.1);
      expect(result).toBeCloseTo(-20, 1);
    });

    it("should convert 2.0 linear to approximately +6 dB", () => {
      const result = controller.linearToDb(2);
      expect(result).toBeCloseTo(6.02, 1);
    });

    it("should handle 0 as negative infinity", () => {
      const result = controller.linearToDb(0);
      expect(result).toBe(-Infinity);
    });

    it("should handle very small values", () => {
      const result = controller.linearToDb(0.0001);
      expect(result).toBeCloseTo(-80, 1);
    });
  });

  describe("applyGain", () => {
    it("should apply positive gain", async () => {
      const result = await controller.applyGain({
        inputPath: "/tmp/input.wav",
        outputPath: "/tmp/output.wav",
        gainDb: 3,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.gainDb).toBe(3);
        expect(result.value.linearGain).toBeCloseTo(1.413, 2);
      }
    });

    it("should apply negative gain", async () => {
      const result = await controller.applyGain({
        inputPath: "/tmp/input.wav",
        outputPath: "/tmp/output.wav",
        gainDb: -10,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.gainDb).toBe(-10);
        expect(result.value.linearGain).toBeCloseTo(0.316, 2);
      }
    });

    it("should apply unity gain (0 dB)", async () => {
      const result = await controller.applyGain({
        inputPath: "/tmp/input.wav",
        outputPath: "/tmp/output.wav",
        gainDb: 0,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.gainDb).toBe(0);
        expect(result.value.linearGain).toBe(1);
      }
    });

    it("should validate gain range", async () => {
      const result = await controller.applyGain({
        inputPath: "/tmp/input.wav",
        outputPath: "/tmp/output.wav",
        gainDb: 50, // Too high
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Gain must be between -60 and +24 dB");
      }
    });
  });

  describe("calculateMixGain", () => {
    it("should calculate gain reduction for 2 sources", () => {
      const gain = controller.calculateMixGain(2);
      expect(gain).toBeCloseTo(-3, 1); // -3 dB for 2 sources
    });

    it("should calculate gain reduction for 4 sources", () => {
      const gain = controller.calculateMixGain(4);
      expect(gain).toBeCloseTo(-6, 1); // -6 dB for 4 sources
    });

    it("should return 0 dB for single source", () => {
      const gain = controller.calculateMixGain(1);
      expect(gain).toBe(0);
    });

    it("should handle many sources", () => {
      const gain = controller.calculateMixGain(8);
      expect(gain).toBeCloseTo(-9, 1); // -9 dB for 8 sources
    });

    it("should handle zero sources", () => {
      const gain = controller.calculateMixGain(0);
      expect(gain).toBe(0);
    });
  });

  describe("preventClipping", () => {
    it("should apply soft limiting when threshold exceeded", async () => {
      const result = await controller.preventClipping({
        inputPath: "/tmp/loud.wav",
        outputPath: "/tmp/limited.wav",
        thresholdDb: -1,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.limited).toBe(true);
        expect(result.value.thresholdDb).toBe(-1);
        expect(result.value.peakLevel).toBeLessThanOrEqual(0);
      }
    });

    it("should not limit when below threshold", async () => {
      const result = await controller.preventClipping({
        inputPath: "/tmp/quiet.wav",
        outputPath: "/tmp/output.wav",
        thresholdDb: -0.1,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.limited).toBe(false);
      }
    });

    it("should use default threshold of -0.1 dB", async () => {
      const result = await controller.preventClipping({
        inputPath: "/tmp/input.wav",
        outputPath: "/tmp/output.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.thresholdDb).toBe(-0.1);
      }
    });

    it("should apply soft knee for smooth limiting", async () => {
      const result = await controller.preventClipping({
        inputPath: "/tmp/loud.wav",
        outputPath: "/tmp/limited.wav",
        thresholdDb: -3,
        kneeWidth: 2,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.kneeWidth).toBe(2);
        expect(result.value.softKnee).toBe(true);
      }
    });
  });

  describe("measureLevels", () => {
    it("should measure RMS level", async () => {
      const result = await controller.measureLevels("/tmp/audio.wav");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.rmsDb).toBeDefined();
        expect(result.value.rmsDb).toBeLessThan(0);
      }
    });

    it("should measure peak level", async () => {
      const result = await controller.measureLevels("/tmp/audio.wav");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.peakDb).toBeDefined();
        expect(result.value.peakDb).toBeLessThanOrEqual(0);
      }
    });

    it("should measure LUFS integrated loudness", async () => {
      const result = await controller.measureLevels("/tmp/audio.wav");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.lufsIntegrated).toBeDefined();
        expect(result.value.lufsIntegrated).toBeLessThan(0);
      }
    });

    it("should measure true peak", async () => {
      const result = await controller.measureLevels("/tmp/audio.wav");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.truePeakDb).toBeDefined();
        expect(result.value.truePeakDb).toBeLessThanOrEqual(0);
      }
    });

    it("should detect clipping", async () => {
      // Mock a file with clipping
      const result = await controller.measureLevels("/tmp/clipped.wav");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.hasClipping).toBeDefined();
        expect(typeof result.value.hasClipping).toBe("boolean");
      }
    });
  });

  describe("normalizeToLufs", () => {
    it("should normalize to -16 LUFS by default", async () => {
      const result = await controller.normalizeToLufs({
        inputPath: "/tmp/input.wav",
        outputPath: "/tmp/normalized.wav",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.targetLufs).toBe(-16);
        expect(result.value.normalized).toBe(true);
      }
    });

    it("should normalize to custom LUFS target", async () => {
      const result = await controller.normalizeToLufs({
        inputPath: "/tmp/input.wav",
        outputPath: "/tmp/normalized.wav",
        targetLufs: -14,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.targetLufs).toBe(-14);
      }
    });

    it("should validate LUFS range", async () => {
      const result = await controller.normalizeToLufs({
        inputPath: "/tmp/input.wav",
        outputPath: "/tmp/normalized.wav",
        targetLufs: -5, // Too loud
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Target LUFS must be between -30 and -10");
      }
    });

    it("should apply true peak limiting", async () => {
      const result = await controller.normalizeToLufs({
        inputPath: "/tmp/input.wav",
        outputPath: "/tmp/normalized.wav",
        targetLufs: -16,
        truePeakDb: -1,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.truePeakDb).toBe(-1);
        expect(result.value.truePeakLimited).toBe(true);
      }
    });

    it("should calculate gain adjustment", async () => {
      const result = await controller.normalizeToLufs({
        inputPath: "/tmp/quiet.wav",
        outputPath: "/tmp/normalized.wav",
        targetLufs: -16,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.gainAdjustmentDb).toBeDefined();
        expect(typeof result.value.gainAdjustmentDb).toBe("number");
      }
    });
  });

  describe("applyCompression", () => {
    it("should apply compression with ratio", async () => {
      const result = await controller.applyCompression({
        inputPath: "/tmp/dynamic.wav",
        outputPath: "/tmp/compressed.wav",
        thresholdDb: -20,
        ratio: 4,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.thresholdDb).toBe(-20);
        expect(result.value.ratio).toBe(4);
        expect(result.value.compressed).toBe(true);
      }
    });

    it("should apply makeup gain", async () => {
      const result = await controller.applyCompression({
        inputPath: "/tmp/dynamic.wav",
        outputPath: "/tmp/compressed.wav",
        thresholdDb: -20,
        ratio: 4,
        makeupGainDb: 5,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.makeupGainDb).toBe(5);
      }
    });

    it("should validate compression ratio", async () => {
      const result = await controller.applyCompression({
        inputPath: "/tmp/dynamic.wav",
        outputPath: "/tmp/compressed.wav",
        thresholdDb: -20,
        ratio: 0.5, // Invalid: less than 1
      });

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Ratio must be 1 or greater");
      }
    });

    it("should apply attack and release times", async () => {
      const result = await controller.applyCompression({
        inputPath: "/tmp/dynamic.wav",
        outputPath: "/tmp/compressed.wav",
        thresholdDb: -20,
        ratio: 3,
        attackMs: 10,
        releaseMs: 100,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.attackMs).toBe(10);
        expect(result.value.releaseMs).toBe(100);
      }
    });
  });
});