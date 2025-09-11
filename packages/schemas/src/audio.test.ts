import { describe, it, expect } from "vitest";
import { 
  SolfeggioFrequencySchema, 
  BinauralBandSchema, 
  AudioLayersSchema,
  validateAudioLayers 
} from "./audio";

describe("Audio Schemas", () => {
  describe("SolfeggioFrequencySchema", () => {
    it("should validate correct frequencies", () => {
      const result = SolfeggioFrequencySchema.parse("528");
      expect(result).toBe(528);
    });

    it("should reject invalid frequencies", () => {
      expect(() => SolfeggioFrequencySchema.parse("999")).toThrow();
    });
  });

  describe("BinauralBandSchema", () => {
    it("should validate correct bands", () => {
      const result = BinauralBandSchema.parse("alpha");
      expect(result).toBe("alpha");
    });

    it("should reject invalid bands", () => {
      expect(() => BinauralBandSchema.parse("invalid")).toThrow();
    });
  });

  describe("validateAudioLayers", () => {
    const baseLayers = {
      voice: { enabled: false },
      background: { enabled: false },
      solfeggio: { enabled: false },
      binaural: { enabled: false },
      gains: {
        voiceDb: -1,
        bgDb: -10,
        solfeggioDb: -16,
        binauralDb: -18,
      },
    };

    it("should allow voice only", () => {
      const layers = { ...baseLayers, voice: { enabled: true } };
      expect(() => validateAudioLayers(layers)).not.toThrow();
    });

    it("should reject background without voice", () => {
      const layers = { ...baseLayers, background: { enabled: true } };
      expect(() => validateAudioLayers(layers)).toThrow("Background audio requires voice");
    });

    it("should reject solfeggio only", () => {
      const layers = { ...baseLayers, solfeggio: { enabled: true } };
      expect(() => validateAudioLayers(layers)).toThrow("Solfeggio tone cannot be used alone");
    });

    it("should reject binaural only", () => {
      const layers = { ...baseLayers, binaural: { enabled: true } };
      expect(() => validateAudioLayers(layers)).toThrow("Binaural beat cannot be used alone");
    });

    it("should reject no layers enabled", () => {
      expect(() => validateAudioLayers(baseLayers)).toThrow("At least one audio layer must be enabled");
    });

    it("should allow solfeggio + binaural combination", () => {
      const layers = {
        ...baseLayers,
        solfeggio: { enabled: true },
        binaural: { enabled: true },
      };
      expect(() => validateAudioLayers(layers)).not.toThrow();
    });
  });
});