import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FFmpegProcessor } from "./FFmpegProcessor";
import type { AudioJob } from "../types";
import type ffmpeg from "fluent-ffmpeg";

// Mock fluent-ffmpeg
vi.mock("fluent-ffmpeg", () => {
  const createMockCommand = () => {
    const mockCommand = {
      input: vi.fn().mockReturnThis(),
      inputOptions: vi.fn().mockReturnThis(),
      output: vi.fn().mockReturnThis(),
      outputOptions: vi.fn().mockReturnThis(),
      audioChannels: vi.fn().mockReturnThis(),
      audioCodec: vi.fn().mockReturnThis(),
      audioBitrate: vi.fn().mockReturnThis(),
      audioFrequency: vi.fn().mockReturnThis(),
      audioFilters: vi.fn().mockReturnThis(),
      complexFilter: vi.fn().mockReturnThis(),
      duration: vi.fn().mockReturnThis(),
      on: vi.fn(function(event, handler) {
        if (event === "end") {
          // Simulate successful completion
          setTimeout(() => handler(), 0);
        }
        return this;
      }),
      run: vi.fn().mockReturnThis(),
      save: vi.fn().mockReturnThis(),
      pipe: vi.fn().mockReturnThis(),
      format: vi.fn().mockReturnThis(),
      kill: vi.fn().mockReturnThis(),
    };
    return mockCommand;
  };

  const ffmpegConstructor = vi.fn((input) => createMockCommand());
  ffmpegConstructor.ffprobe = vi.fn((file, callback) => {
    callback(null, {
      format: {
        duration: 10.5,
        bit_rate: "128000",
        format_name: "mp3",
      },
      streams: [
        {
          codec_type: "audio",
          channels: 2,
          sample_rate: 44100,
          codec_name: "mp3",
        },
      ],
    });
  });
  ffmpegConstructor.setFfmpegPath = vi.fn();
  ffmpegConstructor.setFfprobePath = vi.fn();
  ffmpegConstructor.getAvailableFormats = vi.fn((callback) => {
    callback(null, { formats: [], codecs: [] });
  });

  return {
    default: ffmpegConstructor,
  };
});

describe("FFmpegProcessor", () => {
  let processor: FFmpegProcessor;

  beforeEach(() => {
    processor = new FFmpegProcessor();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with default configuration", () => {
      expect(processor).toBeDefined();
      expect(processor).toBeInstanceOf(FFmpegProcessor);
    });

    it("should accept custom ffmpeg and ffprobe paths", () => {
      const customProcessor = new FFmpegProcessor({
        ffmpegPath: "/custom/ffmpeg",
        ffprobePath: "/custom/ffprobe",
      });
      expect(customProcessor).toBeDefined();
    });
  });

  describe("normalizeLoudness", () => {
    it("should normalize audio to -16 LUFS by default", async () => {
      const inputPath = "/tmp/input.mp3";
      const outputPath = "/tmp/output.mp3";

      const result = await processor.normalizeLoudness(inputPath, outputPath);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.outputPath).toBe(outputPath);
        expect(result.value.targetLufs).toBe(-16);
      }
    });

    it("should accept custom LUFS target", async () => {
      const inputPath = "/tmp/input.mp3";
      const outputPath = "/tmp/output.mp3";
      const targetLufs = -23;

      const result = await processor.normalizeLoudness(inputPath, outputPath, targetLufs);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.targetLufs).toBe(targetLufs);
      }
    });

    it("should enforce stereo output (-ac 2)", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();

      await processor.normalizeLoudness("/tmp/input.mp3", "/tmp/output.mp3");

      expect(commandMock.audioChannels).toHaveBeenCalledWith(2);
    });

    it("should handle processing errors gracefully", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();
      commandMock.on.mockImplementation((event: string, callback: any) => {
        if (event === "error") {
          callback(new Error("FFmpeg processing failed"));
        }
        return commandMock;
      });

      const result = await processor.normalizeLoudness("/tmp/input.mp3", "/tmp/output.mp3");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("FFmpeg processing failed");
      }
    });
  });

  describe("convertFormat", () => {
    it("should convert audio to MP3 format", async () => {
      const inputPath = "/tmp/input.wav";
      const outputPath = "/tmp/output.mp3";

      const result = await processor.convertFormat(inputPath, outputPath, "mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.outputPath).toBe(outputPath);
        expect(result.value.format).toBe("mp3");
      }
    });

    it("should convert audio to WAV format", async () => {
      const inputPath = "/tmp/input.mp3";
      const outputPath = "/tmp/output.wav";

      const result = await processor.convertFormat(inputPath, outputPath, "wav");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.format).toBe("wav");
      }
    });

    it("should enforce stereo output for all conversions", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();

      await processor.convertFormat("/tmp/input.wav", "/tmp/output.mp3", "mp3");

      expect(commandMock.audioChannels).toHaveBeenCalledWith(2);
    });

    it("should apply appropriate bitrate for MP3", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();

      await processor.convertFormat("/tmp/input.wav", "/tmp/output.mp3", "mp3", { bitrate: "192k" });

      expect(commandMock.audioBitrate).toHaveBeenCalledWith("192k");
    });
  });

  describe("mixAudioTracks", () => {
    it("should mix multiple audio tracks with specified gains", async () => {
      const inputs = [
        { path: "/tmp/voice.mp3", gainDb: -1 },
        { path: "/tmp/music.mp3", gainDb: -10 },
      ];
      const outputPath = "/tmp/mixed.mp3";

      const result = await processor.mixAudioTracks(inputs, outputPath);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.outputPath).toBe(outputPath);
        expect(result.value.inputCount).toBe(2);
      }
    });

    it("should enforce stereo output for mixed tracks", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();

      const inputs = [
        { path: "/tmp/voice.mp3", gainDb: 0 },
        { path: "/tmp/music.mp3", gainDb: -6 },
      ];

      await processor.mixAudioTracks(inputs, "/tmp/mixed.mp3");

      expect(commandMock.audioChannels).toHaveBeenCalledWith(2);
    });

    it("should handle single input gracefully", async () => {
      const inputs = [{ path: "/tmp/voice.mp3", gainDb: 0 }];
      const outputPath = "/tmp/output.mp3";

      const result = await processor.mixAudioTracks(inputs, outputPath);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.inputCount).toBe(1);
      }
    });

    it("should reject empty input array", async () => {
      const result = await processor.mixAudioTracks([], "/tmp/output.mp3");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("At least one input track required");
      }
    });
  });

  describe("generateTone", () => {
    it("should generate sine wave tone at specified frequency", async () => {
      const outputPath = "/tmp/tone.mp3";
      const frequency = 528; // Solfeggio frequency
      const durationSec = 5;

      const result = await processor.generateTone({
        frequency,
        durationSec,
        outputPath,
        waveform: "sine",
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.frequency).toBe(frequency);
        expect(result.value.duration).toBe(durationSec);
      }
    });

    it("should generate stereo tone output", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();

      await processor.generateTone({
        frequency: 432,
        durationSec: 10,
        outputPath: "/tmp/tone.mp3",
        waveform: "sine",
      });

      expect(commandMock.audioChannels).toHaveBeenCalledWith(2);
    });

    it("should support different waveforms", async () => {
      const waveforms = ["sine", "triangle", "square"] as const;

      for (const waveform of waveforms) {
        const result = await processor.generateTone({
          frequency: 440,
          durationSec: 1,
          outputPath: `/tmp/tone-${waveform}.mp3`,
          waveform,
        });

        expect(result.isOk).toBe(true);
      }
    });
  });

  describe("generateBinauralBeat", () => {
    it("should generate binaural beat with correct frequencies", async () => {
      const outputPath = "/tmp/binaural.mp3";
      const carrierHz = 200;
      const beatHz = 10; // Alpha band

      const result = await processor.generateBinauralBeat({
        carrierHz,
        beatHz,
        durationSec: 5,
        outputPath,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.leftFreq).toBe(carrierHz - beatHz / 2);
        expect(result.value.rightFreq).toBe(carrierHz + beatHz / 2);
      }
    });

    it("should enforce stereo output for binaural beats", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();

      await processor.generateBinauralBeat({
        carrierHz: 200,
        beatHz: 7.83, // Schumann resonance
        durationSec: 10,
        outputPath: "/tmp/binaural.mp3",
      });

      expect(commandMock.audioChannels).toHaveBeenCalledWith(2);
    });
  });

  describe("insertSilence", () => {
    it("should insert silence at specified position", async () => {
      const inputPath = "/tmp/input.mp3";
      const outputPath = "/tmp/output.mp3";
      const silenceDuration = 3;
      const position = "start";

      const result = await processor.insertSilence({
        inputPath,
        outputPath,
        silenceDuration,
        position,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.silenceDuration).toBe(silenceDuration);
        expect(result.value.position).toBe(position);
      }
    });

    it("should support silence at end position", async () => {
      const result = await processor.insertSilence({
        inputPath: "/tmp/input.mp3",
        outputPath: "/tmp/output.mp3",
        silenceDuration: 2,
        position: "end",
      });

      expect(result.isOk).toBe(true);
    });

    it("should enforce stereo for silence insertion", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();

      await processor.insertSilence({
        inputPath: "/tmp/input.mp3",
        outputPath: "/tmp/output.mp3",
        silenceDuration: 3,
        position: "start",
      });

      expect(commandMock.audioChannels).toHaveBeenCalledWith(2);
    });
  });

  describe("applyFade", () => {
    it("should apply fade in and fade out effects", async () => {
      const inputPath = "/tmp/input.mp3";
      const outputPath = "/tmp/output.mp3";
      const fadeInMs = 1000;
      const fadeOutMs = 1500;

      const result = await processor.applyFade({
        inputPath,
        outputPath,
        fadeInMs,
        fadeOutMs,
      });

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.fadeInMs).toBe(fadeInMs);
        expect(result.value.fadeOutMs).toBe(fadeOutMs);
      }
    });

    it("should enforce stereo output with fades", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();

      await processor.applyFade({
        inputPath: "/tmp/input.mp3",
        outputPath: "/tmp/output.mp3",
        fadeInMs: 500,
        fadeOutMs: 500,
      });

      expect(commandMock.audioChannels).toHaveBeenCalledWith(2);
    });
  });

  describe("processAudioJob", () => {
    it("should process complete audio job with all layers", async () => {
      const audioJob: AudioJob = {
        voiceUrl: "https://example.com/voice.mp3",
        musicUrl: "https://example.com/music.mp3",
        durationMin: 10,
        pauseSec: 3,
        loopMode: "repeat",
        gains: {
          voiceDb: -1,
          musicDb: -10,
          solfeggioDb: -16,
          binauralDb: -18,
        },
        fade: {
          inMs: 1000,
          outMs: 1500,
        },
        channels: 2,
        outputFormat: "mp3",
        solfeggio: {
          enabled: true,
          hz: 528,
          wave: "sine",
        },
        binaural: {
          enabled: true,
          band: "alpha",
          beatHz: 10,
          carrierHz: 200,
        },
        safety: {
          limiter: true,
          targetLufs: -16,
        },
      };

      const outputPath = "/tmp/final.mp3";
      const result = await processor.processAudioJob(audioJob, outputPath);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.outputPath).toBe(outputPath);
        expect(result.value.format).toBe("mp3");
        expect(result.value.channels).toBe(2);
      }
    });

    it("should enforce stereo output for complete pipeline", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();

      const audioJob: AudioJob = {
        durationMin: 5,
        pauseSec: 2,
        loopMode: "repeat",
        gains: {
          voiceDb: 0,
          musicDb: -6,
          solfeggioDb: -12,
          binauralDb: -15,
        },
        fade: {
          inMs: 500,
          outMs: 500,
        },
        channels: 2,
        outputFormat: "mp3",
        safety: {
          limiter: true,
          targetLufs: -16,
        },
      };

      await processor.processAudioJob(audioJob, "/tmp/output.mp3");

      // Should be called multiple times for different stages
      expect(commandMock.audioChannels).toHaveBeenCalled();
      expect(commandMock.audioChannels.mock.calls.every((call) => call[0] === 2)).toBe(true);
    });
  });

  describe("validateStereoCompliance", () => {
    it("should validate stereo audio files", async () => {
      const audioPath = "/tmp/stereo.mp3";
      const result = await processor.validateStereoCompliance(audioPath);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.isStereo).toBe(true);
        expect(result.value.channels).toBe(2);
      }
    });

    it("should reject mono audio files", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")) as any;
      ffmpegMock.ffprobe.mockImplementationOnce((file: string, callback: any) => {
        callback(null, {
          streams: [{ codec_type: "audio", channels: 1 }],
        });
      });

      const result = await processor.validateStereoCompliance("/tmp/mono.mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.isStereo).toBe(false);
        expect(result.value.channels).toBe(1);
      }
    });
  });

  describe("error handling", () => {
    it("should handle file not found errors", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();
      commandMock.on.mockImplementation((event: string, callback: any) => {
        if (event === "error") {
          callback(new Error("Input file not found"));
        }
        return commandMock;
      });

      const result = await processor.convertFormat("/nonexistent/input.mp3", "/tmp/output.mp3", "mp3");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Input file not found");
      }
    });

    it("should handle codec errors gracefully", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();
      commandMock.on.mockImplementation((event: string, callback: any) => {
        if (event === "error") {
          callback(new Error("Unsupported codec"));
        }
        return commandMock;
      });

      const result = await processor.normalizeLoudness("/tmp/input.mp3", "/tmp/output.mp3");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Unsupported codec");
      }
    });
  });

  describe("streaming support", () => {
    it("should support stream processing for large files", async () => {
      const inputStream = {} as any; // Mock stream
      const outputStream = {} as any; // Mock stream

      const result = await processor.processStream(inputStream, outputStream, {
        format: "mp3",
        enforeStereo: true,
      });

      expect(result.isOk).toBe(true);
    });

    it("should enforce stereo on stream processing", async () => {
      const ffmpegMock = (await import("fluent-ffmpeg")).default as any;
      const commandMock = ffmpegMock();

      const inputStream = {} as any;
      const outputStream = {} as any;

      await processor.processStream(inputStream, outputStream, {
        format: "mp3",
        enforeStereo: true,
      });

      expect(commandMock.audioChannels).toHaveBeenCalledWith(2);
    });
  });
});