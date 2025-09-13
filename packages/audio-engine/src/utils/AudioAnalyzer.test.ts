import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioAnalyzer } from "./AudioAnalyzer";
import type { AudioAnalysis } from "../types";

// Mock fluent-ffmpeg
vi.mock("fluent-ffmpeg", () => {
  const mockFfprobe = vi.fn((file, callback) => {
    // Default mock response for stereo MP3
    callback(null, {
      format: {
        duration: 10.5,
        bit_rate: "128000",
        format_name: "mp3",
        size: "168000",
        tags: {
          title: "Test Audio",
          artist: "Test Artist",
        },
      },
      streams: [
        {
          codec_type: "audio",
          codec_name: "mp3",
          channels: 2,
          channel_layout: "stereo",
          sample_rate: 44100,
          bit_rate: "128000",
          duration: 10.5,
        },
      ],
    });
  });

  const ffmpegConstructor = vi.fn();
  ffmpegConstructor.ffprobe = mockFfprobe;
  ffmpegConstructor.setFfmpegPath = vi.fn();
  ffmpegConstructor.setFfprobePath = vi.fn();

  return {
    default: ffmpegConstructor,
  };
});

describe("AudioAnalyzer", () => {
  let analyzer: AudioAnalyzer;

  beforeEach(() => {
    analyzer = new AudioAnalyzer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with default configuration", () => {
      expect(analyzer).toBeDefined();
      expect(analyzer).toBeInstanceOf(AudioAnalyzer);
    });

    it("should accept custom ffprobe path", () => {
      const customAnalyzer = new AudioAnalyzer({
        ffprobePath: "/custom/ffprobe",
      });
      expect(customAnalyzer).toBeDefined();
    });
  });

  describe("analyze", () => {
    it("should analyze stereo audio file", async () => {
      const audioPath = "/tmp/test.mp3";
      const result = await analyzer.analyze(audioPath);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        const analysis = result.value;
        expect(analysis.durationMs).toBe(10500);
        expect(analysis.channels).toBe(2);
        expect(analysis.isStereo).toBe(true);
        expect(analysis.sampleRate).toBe(44100);
        expect(analysis.bitrate).toBe(128000);
        expect(analysis.format).toBe("mp3");
      }
    });

    it("should detect mono audio files", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      ffmpegMock.ffprobe.mockImplementationOnce((file: string, callback: any) => {
        callback(null, {
          format: {
            duration: 5.0,
            bit_rate: "64000",
            format_name: "mp3",
          },
          streams: [
            {
              codec_type: "audio",
              channels: 1,
              channel_layout: "mono",
              sample_rate: 22050,
            },
          ],
        });
      });

      const result = await analyzer.analyze("/tmp/mono.mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.channels).toBe(1);
        expect(result.value.isStereo).toBe(false);
      }
    });

    it("should handle missing audio streams", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      ffmpegMock.ffprobe.mockImplementationOnce((file: string, callback: any) => {
        callback(null, {
          format: { duration: 0 },
          streams: [],
        });
      });

      const result = await analyzer.analyze("/tmp/no-audio.mp4");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("No audio stream found");
      }
    });

    it("should handle file not found errors", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      ffmpegMock.ffprobe.mockImplementationOnce((file: string, callback: any) => {
        callback(new Error("File not found"), null);
      });

      const result = await analyzer.analyze("/nonexistent/file.mp3");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("File not found");
      }
    });
  });

  describe("getDuration", () => {
    it("should get audio duration in milliseconds", async () => {
      const result = await analyzer.getDuration("/tmp/test.mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toBe(10500);
      }
    });

    it("should handle files with no duration", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      ffmpegMock.ffprobe.mockImplementationOnce((file: string, callback: any) => {
        callback(null, {
          format: {},
          streams: [{ codec_type: "audio" }],
        });
      });

      const result = await analyzer.getDuration("/tmp/no-duration.mp3");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Could not determine duration");
      }
    });
  });

  describe("getFormat", () => {
    it("should get audio format information", async () => {
      const result = await analyzer.getFormat("/tmp/test.mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.format).toBe("mp3");
        expect(result.value.codecName).toBe("mp3");
      }
    });

    it("should handle WAV format", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      ffmpegMock.ffprobe.mockImplementationOnce((file: string, callback: any) => {
        callback(null, {
          format: { format_name: "wav" },
          streams: [
            {
              codec_type: "audio",
              codec_name: "pcm_s16le",
              channels: 2,
            },
          ],
        });
      });

      const result = await analyzer.getFormat("/tmp/test.wav");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.format).toBe("wav");
        expect(result.value.codecName).toBe("pcm_s16le");
      }
    });
  });

  describe("validateStereo", () => {
    it("should validate stereo audio as compliant", async () => {
      const result = await analyzer.validateStereo("/tmp/stereo.mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.isValid).toBe(true);
        expect(result.value.channels).toBe(2);
        expect(result.value.reason).toBeUndefined();
      }
    });

    it("should reject mono audio as non-compliant", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      ffmpegMock.ffprobe.mockImplementationOnce((file: string, callback: any) => {
        callback(null, {
          format: { format_name: "mp3" },
          streams: [
            {
              codec_type: "audio",
              channels: 1,
            },
          ],
        });
      });

      const result = await analyzer.validateStereo("/tmp/mono.mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.isValid).toBe(false);
        expect(result.value.channels).toBe(1);
        expect(result.value.reason).toContain("Audio is not stereo");
      }
    });

    it("should reject multi-channel audio", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      ffmpegMock.ffprobe.mockImplementationOnce((file: string, callback: any) => {
        callback(null, {
          format: { format_name: "mp3" },
          streams: [
            {
              codec_type: "audio",
              channels: 6, // 5.1 surround
              channel_layout: "5.1",
            },
          ],
        });
      });

      const result = await analyzer.validateStereo("/tmp/surround.mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.isValid).toBe(false);
        expect(result.value.channels).toBe(6);
        expect(result.value.reason).toContain("Audio has more than 2 channels");
      }
    });
  });

  describe("analyzeLevels", () => {
    it("should analyze audio levels including LUFS", async () => {
      // This would typically use ebur128 filter in FFmpeg
      const result = await analyzer.analyzeLevels("/tmp/test.mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toHaveProperty("peakDb");
        expect(result.value).toHaveProperty("rmsDb");
        expect(result.value).toHaveProperty("lufs");
        expect(result.value.lufs).toBeGreaterThanOrEqual(-30);
        expect(result.value.lufs).toBeLessThanOrEqual(0);
      }
    });

    it("should handle level analysis errors", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      ffmpegMock.ffprobe.mockImplementationOnce((file: string, callback: any) => {
        callback(new Error("Failed to analyze levels"), null);
      });

      const result = await analyzer.analyzeLevels("/tmp/test.mp3");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Failed to analyze levels");
      }
    });
  });

  describe("getMetadata", () => {
    it("should extract audio metadata", async () => {
      const result = await analyzer.getMetadata("/tmp/test.mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.title).toBe("Test Audio");
        expect(result.value.artist).toBe("Test Artist");
      }
    });

    it("should handle missing metadata gracefully", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      ffmpegMock.ffprobe.mockImplementationOnce((file: string, callback: any) => {
        callback(null, {
          format: {
            format_name: "mp3",
            tags: {},
          },
          streams: [{ codec_type: "audio", channels: 2 }],
        });
      });

      const result = await analyzer.getMetadata("/tmp/no-metadata.mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toEqual({});
      }
    });
  });

  describe("batch analysis", () => {
    it("should analyze multiple files efficiently", async () => {
      const files = ["/tmp/file1.mp3", "/tmp/file2.mp3", "/tmp/file3.mp3"];
      const results = await analyzer.analyzeMultiple(files);

      expect(results.length).toBe(3);
      expect(results.every((r) => r.isOk)).toBe(true);
    });

    it("should handle partial failures in batch analysis", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      let callCount = 0;
      ffmpegMock.ffprobe.mockImplementation((file: string, callback: any) => {
        callCount++;
        if (callCount === 2) {
          callback(new Error("File corrupted"), null);
        } else {
          callback(null, {
            format: { duration: 5, format_name: "mp3" },
            streams: [{ codec_type: "audio", channels: 2 }],
          });
        }
      });

      const files = ["/tmp/file1.mp3", "/tmp/corrupted.mp3", "/tmp/file3.mp3"];
      const results = await analyzer.analyzeMultiple(files);

      expect(results.length).toBe(3);
      expect(results[0].isOk).toBe(true);
      expect(results[1].isOk).toBe(false);
      expect(results[2].isOk).toBe(true);
    });
  });

  describe("performance", () => {
    it("should cache analysis results for repeated queries", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const ffprobeSpy = vi.spyOn(ffmpegMock, "ffprobe");

      const audioPath = "/tmp/cached.mp3";

      // First call
      await analyzer.analyze(audioPath);
      expect(ffprobeSpy).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await analyzer.analyze(audioPath);
      expect(ffprobeSpy).toHaveBeenCalledTimes(1); // Still 1, not 2

      // Different file should trigger new analysis
      await analyzer.analyze("/tmp/different.mp3");
      expect(ffprobeSpy).toHaveBeenCalledTimes(2);
    });

    it("should invalidate cache after TTL expires", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const ffprobeSpy = vi.spyOn(ffmpegMock, "ffprobe");

      const audioPath = "/tmp/cached.mp3";
      const analyzerWithShortTTL = new AudioAnalyzer({ cacheTtlMs: 100 });

      await analyzerWithShortTTL.analyze(audioPath);
      expect(ffprobeSpy).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      await analyzerWithShortTTL.analyze(audioPath);
      expect(ffprobeSpy).toHaveBeenCalledTimes(2);
    });
  });
});