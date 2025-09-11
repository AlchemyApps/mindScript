// Solfeggio frequencies with descriptions
export const SOLFEGGIO_FREQUENCIES = {
  174: { name: "Ease & Grounding", description: "Physical and mental easing; releases tension" },
  285: { name: "Reset & Restore", description: "Gentle reset feeling; supports recovery" },
  396: { name: "Release & Momentum", description: "Letting go of guilt/fear; encourages confidence" },
  417: { name: "Change & Creativity", description: "Transitions and fresh starts; creative flow" },
  528: { name: "Soothing Renewal", description: "Popular feel-good tone; warmth and calm" },
  639: { name: "Connection & Communication", description: "Empathy and clearer communication" },
  741: { name: "Clear & Cleanse", description: "Mental decluttering; honest expression" },
  852: { name: "Intuition & Clarity", description: "Reflective, intuitive states; inner guidance" },
  963: { name: "Spacious & Open", description: "Expansive; quiet mind and connectedness" },
} as const;

// Binaural beat bands with descriptions
export const BINAURAL_BANDS = {
  delta: { range: [1, 4], name: "Deep Rest", description: "Deep relaxation and sleep-like calm" },
  theta: { range: [4, 8], name: "Meditative Drift", description: "Creativity, imagery, and meditative depth" },
  alpha: { range: [8, 13], name: "Relaxed Focus", description: "Calm concentration; present yet unhurried" },
  beta: { range: [14, 30], name: "Alert & Engaged", description: "Active thinking and task engagement" },
  gamma: { range: [30, 100], name: "Insight & Integration", description: "High-level integration and insights" },
} as const;

// Audio quality constants
export const AUDIO_CONSTANTS = {
  CHANNELS: 2, // Always stereo
  SAMPLE_RATE: 44100,
  BIT_DEPTH: 16,
  MP3_BITRATE: 192,
  WAV_FORMAT: "PCM",
  TARGET_LUFS: -16.0,
  MAX_DURATION_SECONDS: 900, // 15 minutes
  MIN_DURATION_SECONDS: 300, // 5 minutes
} as const;

// Default gain levels in dB
export const DEFAULT_GAINS = {
  VOICE: -1.0,
  MUSIC: -10.0,
  SOLFEGGIO: -16.0,
  BINAURAL: -18.0,
} as const;

// Default fade times in milliseconds
export const DEFAULT_FADES = {
  FADE_IN: 1000,
  FADE_OUT: 1500,
} as const;