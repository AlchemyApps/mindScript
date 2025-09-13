export { BaseTTSProvider } from "./TTSProvider.interface";
export { OpenAIProvider } from "./OpenAIProvider";
export { ElevenLabsProvider } from "./ElevenLabsProvider";
export type {
  TTSProvider,
  TTSSynthesisRequest,
  TTSSynthesisResponse,
  TTSVoice,
  TTSProviderConfig,
  RateLimitConfig,
  OpenAIModel,
  OpenAIVoice,
  OpenAIFormat,
  ElevenLabsModel,
  ElevenLabsVoiceSettings,
  TTSError,
  TTSErrorCode,
} from "../types/tts.types";