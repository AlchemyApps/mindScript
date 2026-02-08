/**
 * Voice Cloning Schemas
 * Comprehensive validation schemas for ElevenLabs voice cloning feature
 */

import { z } from "zod";

/**
 * Voice upload validation schema
 * Ensures audio files meet ElevenLabs requirements
 */
export const voiceUploadSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number()
    .min(100000, "File must be at least 100KB")
    .max(10485760, "File must be less than 10MB"),
  mimeType: z.enum(["audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav", "audio/webm", "audio/ogg"]),
  duration: z.number()
    .min(60, "Audio must be at least 60 seconds")
    .max(180, "Audio must be less than 180 seconds"),
  sampleRate: z.number().min(22050, "Sample rate must be at least 22050Hz"),
  bitrate: z.number().min(128000, "Bitrate must be at least 128kbps"),
});

/**
 * Voice consent schema
 * Legal compliance and consent verification
 */
export const voiceConsentSchema = z.object({
  hasConsent: z.literal(true, {
    errorMap: () => ({ message: "Explicit consent is required" })
  }),
  isOver18: z.literal(true, {
    errorMap: () => ({ message: "Must be 18 years or older" })
  }),
  acceptsTerms: z.literal(true, {
    errorMap: () => ({ message: "Must accept terms of service" })
  }),
  ownsVoice: z.literal(true, {
    errorMap: () => ({ message: "Must confirm voice ownership" })
  }),
  understandsUsage: z.literal(true, {
    errorMap: () => ({ message: "Must understand usage terms" })
  }),
  noImpersonation: z.literal(true, {
    errorMap: () => ({ message: "Must agree to no impersonation policy" })
  }),
  timestamp: z.string().datetime(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
});

/**
 * Cloned voice record schema
 * Database record for a cloned voice
 */
export const clonedVoiceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  voiceId: z.string(), // ElevenLabs voice ID
  voiceName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  sampleFileUrl: z.string().url().optional(),
  consentData: voiceConsentSchema.optional(),
  status: z.enum(["pending", "processing", "active", "failed", "deleted"]),
  usageCount: z.number().int().min(0).default(0),
  monthlyUsageLimit: z.number().int().min(0),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().optional(),
});

/**
 * Voice labels schema
 * Optional metadata for voice characteristics
 */
export const voiceLabelsSchema = z.object({
  accent: z.string().optional(),
  description: z.string().optional(),
  age: z.enum(["young", "middle", "old"]).optional(),
  gender: z.enum(["male", "female", "neutral"]).optional(),
  useCase: z.string().optional(),
});

/**
 * Voice clone request schema
 * API request to clone a voice
 */
export const voiceCloneRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  uploadData: voiceUploadSchema,
  consent: voiceConsentSchema,
  labels: voiceLabelsSchema.optional(),
});

/**
 * Voice clone response schema
 * API response after voice cloning
 */
export const voiceCloneResponseSchema = z.object({
  success: z.boolean(),
  voiceId: z.string().optional(),
  voice: clonedVoiceSchema.optional(),
  error: z.string().optional(),
  processingTime: z.number().optional(),
});

/**
 * Voice preview request schema
 * Request to preview a cloned voice
 */
export const voicePreviewRequestSchema = z.object({
  voiceId: z.string(),
  text: z.string().min(1).max(500),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
});

/**
 * Voice usage tracking schema
 * Track usage and limits for cloned voices
 */
export const voiceUsageSchema = z.object({
  voiceId: z.string().uuid(),
  userId: z.string().uuid(),
  currentMonthUsage: z.number().int().min(0),
  monthlyLimit: z.number().int().min(0),
  totalUsage: z.number().int().min(0),
  lastUsedAt: z.string().datetime().optional(),
  resetDate: z.string().datetime().optional(),
});

/**
 * Voice management action schema
 * Actions that can be performed on cloned voices
 */
export const voiceManagementSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete"),
    voiceId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("rename"),
    voiceId: z.string().uuid(),
    newName: z.string().min(1).max(100),
  }),
  z.object({
    action: z.literal("updateDescription"),
    voiceId: z.string().uuid(),
    description: z.string().max(500),
  }),
  z.object({
    action: z.literal("archive"),
    voiceId: z.string().uuid(),
  }),
]);

/**
 * Voice deletion request schema
 * GDPR-compliant deletion request
 */
export const voiceDeletionRequestSchema = z.object({
  voiceId: z.string().uuid(),
  reason: z.string().optional(),
  confirmDeletion: z.literal(true),
  deleteAllData: z.boolean().default(true),
});

/**
 * Subscription tier limits schema
 * Define voice cloning limits per subscription tier
 */
export const subscriptionLimitsSchema = z.object({
  tier: z.enum(["free", "basic", "premium", "enterprise"]),
  maxVoices: z.number().int().min(0),
  monthlyUsageLimit: z.number().int().min(0),
  allowCustomVoices: z.boolean(),
  maxUploadSize: z.number().int().min(0),
  maxDuration: z.number().int().min(0),
});

// Type exports
export type VoiceUpload = z.infer<typeof voiceUploadSchema>;
export type VoiceConsent = z.infer<typeof voiceConsentSchema>;
export type ClonedVoice = z.infer<typeof clonedVoiceSchema>;
export type VoiceLabels = z.infer<typeof voiceLabelsSchema>;
export type VoiceCloneRequest = z.infer<typeof voiceCloneRequestSchema>;
export type VoiceCloneResponse = z.infer<typeof voiceCloneResponseSchema>;
export type VoicePreviewRequest = z.infer<typeof voicePreviewRequestSchema>;
export type VoiceUsage = z.infer<typeof voiceUsageSchema>;
export type VoiceManagement = z.infer<typeof voiceManagementSchema>;
export type VoiceDeletionRequest = z.infer<typeof voiceDeletionRequestSchema>;
export type SubscriptionLimits = z.infer<typeof subscriptionLimitsSchema>;

// Default subscription limits
export const SUBSCRIPTION_LIMITS: Record<string, SubscriptionLimits> = {
  free: {
    tier: "free",
    maxVoices: 0,
    monthlyUsageLimit: 0,
    allowCustomVoices: false,
    maxUploadSize: 0,
    maxDuration: 0,
  },
  basic: {
    tier: "basic",
    maxVoices: 1,
    monthlyUsageLimit: 10,
    allowCustomVoices: true,
    maxUploadSize: 5242880, // 5MB
    maxDuration: 120, // 2 minutes
  },
  premium: {
    tier: "premium",
    maxVoices: 3,
    monthlyUsageLimit: 100,
    allowCustomVoices: true,
    maxUploadSize: 10485760, // 10MB
    maxDuration: 180, // 3 minutes
  },
  enterprise: {
    tier: "enterprise",
    maxVoices: 10,
    monthlyUsageLimit: 1000,
    allowCustomVoices: true,
    maxUploadSize: 20971520, // 20MB
    maxDuration: 300, // 5 minutes
  },
};