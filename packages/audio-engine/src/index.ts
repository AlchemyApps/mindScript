// Audio engine contracts and utilities

// Queue management
export { QueueManager } from "./queue/QueueManager";

// Audio processing
export { FFmpegProcessor } from "./processors/FFmpegProcessor";

// TTS Providers
export { 
  BaseTTSProvider,
  OpenAIProvider,
  ElevenLabsProvider 
} from "./providers";

// Cache
export { VoiceCache } from "./cache/VoiceCache";

// Utilities
export { AudioAnalyzer } from "./utils/AudioAnalyzer";
export { TempFileManager } from "./utils/TempFileManager";

// Constants and configuration
export { 
  SOLFEGGIO_FREQUENCIES,
  BINAURAL_BANDS,
  AUDIO_CONSTANTS,
  DEFAULT_GAINS,
  DEFAULT_FADES
} from "./constants";

// Types
export * from "./types";
export * from "./types/tts.types";
export * from "./utils";