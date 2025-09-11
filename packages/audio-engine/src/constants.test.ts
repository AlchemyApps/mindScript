import { describe, it, expect } from "vitest";
import { SOLFEGGIO_FREQUENCIES, BINAURAL_BANDS, DEFAULT_GAINS } from "./constants";

describe("Audio Engine Constants", () => {
  describe("SOLFEGGIO_FREQUENCIES", () => {
    it("should contain all expected frequencies", () => {
      const frequencies = Object.keys(SOLFEGGIO_FREQUENCIES).map(Number);
      expect(frequencies).toEqual([174, 285, 396, 417, 528, 639, 741, 852, 963]);
    });

    it("should have proper structure for each frequency", () => {
      const freq528 = SOLFEGGIO_FREQUENCIES[528];
      expect(freq528).toHaveProperty("name");
      expect(freq528).toHaveProperty("description");
      expect(typeof freq528.name).toBe("string");
      expect(typeof freq528.description).toBe("string");
    });
  });

  describe("BINAURAL_BANDS", () => {
    it("should contain all expected bands", () => {
      const bands = Object.keys(BINAURAL_BANDS);
      expect(bands).toEqual(["delta", "theta", "alpha", "beta", "gamma"]);
    });

    it("should have proper frequency ranges", () => {
      const alpha = BINAURAL_BANDS.alpha;
      expect(alpha.range).toEqual([8, 13]);
      expect(alpha.name).toBe("Relaxed Focus");
      expect(typeof alpha.description).toBe("string");
    });
  });

  describe("DEFAULT_GAINS", () => {
    it("should have reasonable gain values", () => {
      expect(DEFAULT_GAINS.VOICE).toBe(-1.0);
      expect(DEFAULT_GAINS.MUSIC).toBe(-10.0);
      expect(DEFAULT_GAINS.SOLFEGGIO).toBe(-16.0);
      expect(DEFAULT_GAINS.BINAURAL).toBe(-18.0);
    });
  });
});