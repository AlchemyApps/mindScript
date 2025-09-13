import { 
  UserId, 
  AudioProjectId, 
  RenderId, 
  ScriptId, 
  BackgroundTrackId, 
  VoiceId,
  Timestamps,
  Status 
} from "./common";

// Solfeggio frequencies as defined in PRD
export type SolfeggioFrequency = 174 | 285 | 396 | 417 | 528 | 639 | 741 | 852 | 963;

// Binaural beat bands as defined in PRD  
export type BinauralBand = "delta" | "theta" | "alpha" | "beta" | "gamma";

// Voice provider types
export type VoiceProvider = "openai" | "elevenlabs" | "uploaded";

// OpenAI TTS voice options
export type OpenAIVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export type Voice = {
  id: VoiceId;
  provider: VoiceProvider;
  code: string; // e.g., "alloy", "echo" for OpenAI, or voice_id for ElevenLabs
  label: string; // Display name
  isEnabled: boolean;
  isPremium: boolean;
};

export type Script = {
  id: ScriptId;
  ownerId: UserId;
  title: string;
  content: string;
  tags: string[];
  isTemplate: boolean;
} & Timestamps;

export type BackgroundTrack = {
  id: BackgroundTrackId;
  ownerId?: UserId; // null for platform assets
  title: string;
  url: string;
  priceCents: number;
  isPlatformAsset: boolean;
  isStereo: boolean;
  licenseNote?: string;
  tags: string[];
} & Timestamps;

// Audio layers configuration
export type AudioLayers = {
  voice: {
    enabled: boolean;
    provider?: VoiceProvider;
    voiceCode?: string; // OpenAI voice or ElevenLabs voice_id
  };
  background: {
    enabled: boolean;
    trackId?: BackgroundTrackId;
  };
  solfeggio: {
    enabled: boolean;
    hz?: SolfeggioFrequency;
  };
  binaural: {
    enabled: boolean;
    band?: BinauralBand;
    beatHz?: number;
    carrierHz?: number;
  };
  gains: {
    voiceDb: number;
    bgDb: number;
    solfeggioDb: number;
    binauralDb: number;
  };
};

export type AudioProject = {
  id: AudioProjectId;
  ownerId: UserId;
  scriptId: ScriptId;
  voiceRef: string; // Reference to voice (provider:code format)
  durationMin: 5 | 10 | 15;
  pauseSec: number; // 1-30 seconds
  loopMode: "repeat" | "interval";
  intervalSec?: number; // For interval mode
  bgTrackId?: BackgroundTrackId;
  title: string;
  layersJson: AudioLayers; // JSONB field
} & Timestamps;

// Audio rendering job schema
export type AudioJob = {
  voiceUrl?: string;
  musicUrl?: string;
  durationMin: number;
  pauseSec: number;
  loopMode: "repeat" | "interval";
  intervalSec?: number;
  gains: {
    voiceDb: number;
    musicDb: number;
    solfeggioDb: number;
    binauralDb: number;
  };
  fade: {
    inMs: number;
    outMs: number;
  };
  channels: 2; // Always stereo
  outputFormat: "mp3" | "wav";
  solfeggio?: {
    enabled: boolean;
    hz: SolfeggioFrequency;
    wave: "sine" | "triangle" | "square";
  };
  binaural?: {
    enabled: boolean;
    band: BinauralBand;
    beatHz: number;
    carrierHz: number;
  };
  safety: {
    limiter: boolean;
    targetLufs: number;
  };
};

export type Render = {
  id: RenderId;
  projectId: AudioProjectId;
  status: Status;
  outputUrl?: string;
  durationMs?: number;
  channels?: number;
  bitrate?: number;
  renderParamsJson: AudioJob; // JSONB field with render parameters used
  errorMessage?: string;
} & Timestamps;

// Duration options as defined in PRD
export type Duration = 5 | 10 | 15;

// Job queue types
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
export type JobPriority = "low" | "normal" | "high" | "urgent";

export interface AudioJobQueue {
  id: string;
  userId: string;
  projectId?: string;
  renderId?: string;
  status: JobStatus;
  priority: JobPriority;
  payload: AudioJobPayload;
  progress: number;
  progressMessage?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  lockedAt?: Date;
  lockedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface AudioJobPayload {
  type: "render" | "preview" | "export";
  projectData: {
    scriptText: string;
    voiceRef: string;
    durationMin: number;
    pauseSec: number;
    loopMode: "repeat" | "interval";
    intervalSec?: number;
    layers: AudioJobLayers;
  };
  outputOptions: {
    format: "mp3" | "wav";
    quality?: "draft" | "standard" | "high";
    storageLocation?: "public" | "private";
  };
}

export interface AudioJobLayers {
  voice: {
    enabled: boolean;
    provider?: "openai" | "elevenlabs" | "uploaded";
    voiceCode?: string;
    voiceUrl?: string;
  };
  background: {
    enabled: boolean;
    trackUrl?: string;
  };
  solfeggio?: {
    enabled: boolean;
    hz?: number;
    wave?: "sine" | "triangle" | "square";
  };
  binaural?: {
    enabled: boolean;
    band?: "delta" | "theta" | "alpha" | "beta" | "gamma";
    beatHz?: number;
    carrierHz?: number;
  };
  gains: {
    voiceDb: number;
    bgDb: number;
    solfeggioDb?: number;
    binauralDb?: number;
  };
}

export interface CreateAudioJobInput {
  userId: string;
  projectId?: string;
  priority?: JobPriority;
  payload: AudioJobPayload;
  metadata?: Record<string, unknown>;
}

export interface JobProgressUpdate {
  jobId: string;
  progress: number;
  message?: string;
}

export interface JobResult {
  jobId: string;
  status: JobStatus;
  outputUrl?: string;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    details?: Record<string, unknown>;
  };
}