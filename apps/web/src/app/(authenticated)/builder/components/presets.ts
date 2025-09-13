import { DEFAULT_GAINS } from '@mindscript/audio-engine/constants';

export interface AudioControlSettings {
  solfeggio?: {
    frequency: number;
    volume_db: number;
  };
  binaural?: {
    band: 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';
    carrier_frequency: number;
    volume_db: number;
  };
  gains: {
    master: number;
    voice: number;
    music: number;
    solfeggio: number;
    binaural: number;
  };
}

export interface Preset {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  settings: AudioControlSettings;
}

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'meditation',
    name: 'Meditation',
    description: 'Deep relaxation with theta waves',
    isDefault: true,
    settings: {
      solfeggio: { frequency: 528, volume_db: -16 },
      binaural: { band: 'theta', carrier_frequency: 250, volume_db: -18 },
      gains: { 
        master: 0, 
        voice: -1, 
        music: -10, 
        solfeggio: -16, 
        binaural: -18 
      },
    },
  },
  {
    id: 'focus',
    name: 'Focus',
    description: 'Enhanced concentration with beta waves',
    isDefault: true,
    settings: {
      solfeggio: { frequency: 741, volume_db: -20 },
      binaural: { band: 'beta', carrier_frequency: 300, volume_db: -20 },
      gains: { 
        master: 0, 
        voice: 0, 
        music: -15, 
        solfeggio: -20, 
        binaural: -20 
      },
    },
  },
  {
    id: 'sleep',
    name: 'Sleep',
    description: 'Deep sleep induction with delta waves',
    isDefault: true,
    settings: {
      solfeggio: { frequency: 174, volume_db: -14 },
      binaural: { band: 'delta', carrier_frequency: 200, volume_db: -16 },
      gains: { 
        master: -2, 
        voice: -3, 
        music: -8, 
        solfeggio: -14, 
        binaural: -16 
      },
    },
  },
  {
    id: 'energy',
    name: 'Energy',
    description: 'Boost alertness with gamma waves',
    isDefault: true,
    settings: {
      solfeggio: { frequency: 963, volume_db: -18 },
      binaural: { band: 'gamma', carrier_frequency: 400, volume_db: -22 },
      gains: { 
        master: 1, 
        voice: 2, 
        music: -12, 
        solfeggio: -18, 
        binaural: -22 
      },
    },
  },
  {
    id: 'creativity',
    name: 'Creativity',
    description: 'Creative flow with alpha waves',
    isDefault: true,
    settings: {
      solfeggio: { frequency: 417, volume_db: -16 },
      binaural: { band: 'alpha', carrier_frequency: 280, volume_db: -18 },
      gains: { 
        master: 0, 
        voice: -1, 
        music: -11, 
        solfeggio: -16, 
        binaural: -18 
      },
    },
  },
  {
    id: 'healing',
    name: 'Healing',
    description: 'Restorative frequencies for wellness',
    isDefault: true,
    settings: {
      solfeggio: { frequency: 285, volume_db: -14 },
      binaural: { band: 'theta', carrier_frequency: 220, volume_db: -16 },
      gains: { 
        master: -1, 
        voice: -2, 
        music: -9, 
        solfeggio: -14, 
        binaural: -16 
      },
    },
  },
  {
    id: 'balance',
    name: 'Balance',
    description: 'Harmonious blend of all frequencies',
    isDefault: true,
    settings: {
      solfeggio: { frequency: 639, volume_db: -16 },
      binaural: { band: 'alpha', carrier_frequency: 250, volume_db: -18 },
      gains: { 
        master: 0, 
        voice: DEFAULT_GAINS.VOICE, 
        music: DEFAULT_GAINS.MUSIC, 
        solfeggio: DEFAULT_GAINS.SOLFEGGIO, 
        binaural: DEFAULT_GAINS.BINAURAL 
      },
    },
  },
  {
    id: 'voice-only',
    name: 'Voice Only',
    description: 'Pure narration without effects',
    isDefault: true,
    settings: {
      gains: { 
        master: 0, 
        voice: 0, 
        music: -30, 
        solfeggio: -30, 
        binaural: -30 
      },
    },
  },
];

export const PRESET_STORAGE_KEY = 'mindscript_audio_presets';
export const MAX_CUSTOM_PRESETS = 20;