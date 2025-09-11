import { z } from "zod";
import {
  UserIdSchema,
  AudioProjectIdSchema,
  RenderIdSchema,
  ScriptIdSchema,
  BackgroundTrackIdSchema,
  VoiceIdSchema,
  TimestampsSchema,
  StatusSchema,
} from "./common";

// Solfeggio frequencies as defined in PRD
export const SolfeggioFrequencySchema = z.enum([
  "174", "285", "396", "417", "528", "639", "741", "852", "963"
]).transform(val => parseInt(val, 10) as 174 | 285 | 396 | 417 | 528 | 639 | 741 | 852 | 963);

// Binaural beat bands
export const BinauralBandSchema = z.enum([
  "delta", "theta", "alpha", "beta", "gamma"
]);

// Voice providers
export const VoiceProviderSchema = z.enum(["openai", "elevenlabs", "uploaded"]);

// OpenAI TTS voices
export const OpenAIVoiceSchema = z.enum([
  "alloy", "echo", "fable", "onyx", "nova", "shimmer"
]);

// Duration options
export const DurationSchema = z.enum(["5", "10", "15"]).transform(val => parseInt(val, 10) as 5 | 10 | 15);

// Voice schema
export const VoiceSchema = z.object({
  id: VoiceIdSchema,
  provider: VoiceProviderSchema,
  code: z.string(),
  label: z.string(),
  isEnabled: z.boolean(),
  isPremium: z.boolean(),
});

// Script schema
export const ScriptSchema = z.object({
  id: ScriptIdSchema,
  ownerId: UserIdSchema,
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000), // 5000 char limit for TTS
  tags: z.array(z.string()),
  isTemplate: z.boolean(),
}).merge(TimestampsSchema);

// Background track schema
export const BackgroundTrackSchema = z.object({
  id: BackgroundTrackIdSchema,
  ownerId: UserIdSchema.optional(),
  title: z.string().min(1).max(200),
  url: z.string().url(),
  priceCents: z.number().int().min(0),
  isPlatformAsset: z.boolean(),
  isStereo: z.boolean(),
  licenseNote: z.string().optional(),
  tags: z.array(z.string()),
}).merge(TimestampsSchema);

// Audio layers configuration
export const AudioLayersSchema = z.object({
  voice: z.object({
    enabled: z.boolean(),
    provider: VoiceProviderSchema.optional(),
    voiceCode: z.string().optional(),
  }),
  background: z.object({
    enabled: z.boolean(),
    trackId: BackgroundTrackIdSchema.optional(),
  }),
  solfeggio: z.object({
    enabled: z.boolean(),
    hz: SolfeggioFrequencySchema.optional(),
  }),
  binaural: z.object({
    enabled: z.boolean(),
    band: BinauralBandSchema.optional(),
    beatHz: z.number().min(0.1).max(100).optional(),
    carrierHz: z.number().min(50).max(1000).optional(),
  }),
  gains: z.object({
    voiceDb: z.number().min(-30).max(10).default(-1),
    bgDb: z.number().min(-30).max(10).default(-10),
    solfeggioDb: z.number().min(-30).max(10).default(-16),
    binauralDb: z.number().min(-30).max(10).default(-18),
  }),
});

// Audio project creation/update schemas
export const CreateAudioProjectSchema = z.object({
  scriptId: ScriptIdSchema,
  voiceRef: z.string(), // format: "provider:code"
  durationMin: DurationSchema,
  pauseSec: z.number().int().min(1).max(30).default(3),
  loopMode: z.enum(["repeat", "interval"]).default("repeat"),
  intervalSec: z.number().int().min(30).max(300).optional(),
  bgTrackId: BackgroundTrackIdSchema.optional(),
  title: z.string().min(1).max(200),
  layersJson: AudioLayersSchema,
});

export const UpdateAudioProjectSchema = CreateAudioProjectSchema.partial();

export const AudioProjectSchema = z.object({
  id: AudioProjectIdSchema,
  ownerId: UserIdSchema,
}).merge(CreateAudioProjectSchema).merge(TimestampsSchema);

// Audio job schema for rendering
export const AudioJobSchema = z.object({
  voiceUrl: z.string().url().optional(),
  musicUrl: z.string().url().optional(),
  durationMin: z.number().int().min(5).max(15),
  pauseSec: z.number().min(1).max(30),
  loopMode: z.enum(["repeat", "interval"]),
  intervalSec: z.number().int().min(30).max(300).optional(),
  gains: z.object({
    voiceDb: z.number().min(-30).max(10),
    musicDb: z.number().min(-30).max(10),
    solfeggioDb: z.number().min(-30).max(10),
    binauralDb: z.number().min(-30).max(10),
  }),
  fade: z.object({
    inMs: z.number().int().min(0).max(5000).default(1000),
    outMs: z.number().int().min(0).max(5000).default(1500),
  }),
  channels: z.literal(2), // Always stereo
  outputFormat: z.enum(["mp3", "wav"]).default("mp3"),
  solfeggio: z.object({
    enabled: z.boolean(),
    hz: SolfeggioFrequencySchema,
    wave: z.enum(["sine", "triangle", "square"]).default("sine"),
  }).optional(),
  binaural: z.object({
    enabled: z.boolean(),
    band: BinauralBandSchema,
    beatHz: z.number().min(0.1).max(100),
    carrierHz: z.number().min(50).max(1000),
  }).optional(),
  safety: z.object({
    limiter: z.boolean().default(true),
    targetLufs: z.number().min(-30).max(-6).default(-16),
  }),
});

// Render schema
export const RenderSchema = z.object({
  id: RenderIdSchema,
  projectId: AudioProjectIdSchema,
  status: StatusSchema,
  outputUrl: z.string().url().optional(),
  durationMs: z.number().int().min(0).optional(),
  channels: z.number().int().min(1).max(2).optional(),
  bitrate: z.number().int().min(64).max(320).optional(),
  renderParamsJson: AudioJobSchema,
  errorMessage: z.string().optional(),
}).merge(TimestampsSchema);

// Validation rules from PRD
export const validateAudioLayers = (layers: z.infer<typeof AudioLayersSchema>) => {
  const hasVoice = layers.voice.enabled;
  const hasBackground = layers.background.enabled;
  const hasSolfeggio = layers.solfeggio.enabled;
  const hasBinaural = layers.binaural.enabled;

  // At least one layer must be selected
  if (!hasVoice && !hasBackground && !hasSolfeggio && !hasBinaural) {
    throw new Error("At least one audio layer must be enabled");
  }

  // Background requires Voice
  if (hasBackground && !hasVoice) {
    throw new Error("Background audio requires voice to be enabled");
  }

  // Solfeggio and Binaural cannot be solo (but can be combined)
  if (hasSolfeggio && !hasVoice && !hasBackground && !hasBinaural) {
    throw new Error("Solfeggio tone cannot be used alone");
  }

  if (hasBinaural && !hasVoice && !hasBackground && !hasSolfeggio) {
    throw new Error("Binaural beat cannot be used alone");
  }

  return true;
};