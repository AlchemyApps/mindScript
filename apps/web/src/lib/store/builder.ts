import { create } from "zustand";

interface BuilderStore {
  script: string;
  title: string;
  voiceId: string;
  backgroundMusicId: string | null;
  frequencyType: "none" | "solfeggio" | "binaural";
  frequencyValue: number;
  frequencyGain: number;
  setScript: (script: string) => void;
  setTitle: (title: string) => void;
  setVoiceId: (voiceId: string) => void;
  setBackgroundMusicId: (musicId: string | null) => void;
  setFrequency: (type: "none" | "solfeggio" | "binaural", value: number, gain: number) => void;
  reset: () => void;
}

const initialState = {
  script: "",
  title: "",
  voiceId: "alloy",
  backgroundMusicId: null,
  frequencyType: "none" as const,
  frequencyValue: 528,
  frequencyGain: 0.1,
};

export const useBuilderStore = create<BuilderStore>((set) => ({
  ...initialState,
  setScript: (script) => set({ script }),
  setTitle: (title) => set({ title }),
  setVoiceId: (voiceId) => set({ voiceId }),
  setBackgroundMusicId: (musicId) => set({ backgroundMusicId: musicId }),
  setFrequency: (type, value, gain) =>
    set({ frequencyType: type, frequencyValue: value, frequencyGain: gain }),
  reset: () => set(initialState),
}));