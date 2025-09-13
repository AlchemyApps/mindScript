import { z } from "zod";

// Job status and priority enums
export const JobStatusSchema = z.enum(["pending", "processing", "completed", "failed", "cancelled"]);
export const JobPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

// Audio job layers schema (for payload)
export const AudioJobLayersSchema = z.object({
  voice: z.object({
    enabled: z.boolean(),
    provider: z.enum(["openai", "elevenlabs", "uploaded"]).optional(),
    voiceCode: z.string().optional(),
    voiceUrl: z.string().url().optional(),
  }),
  background: z.object({
    enabled: z.boolean(),
    trackUrl: z.string().url().optional(),
  }),
  solfeggio: z.object({
    enabled: z.boolean(),
    hz: z.number().optional(),
    wave: z.enum(["sine", "triangle", "square"]).optional(),
  }).optional(),
  binaural: z.object({
    enabled: z.boolean(),
    band: z.enum(["delta", "theta", "alpha", "beta", "gamma"]).optional(),
    beatHz: z.number().min(0.1).max(100).optional(),
    carrierHz: z.number().min(50).max(1000).optional(),
  }).optional(),
  gains: z.object({
    voiceDb: z.number().min(-30).max(10),
    bgDb: z.number().min(-30).max(10),
    solfeggioDb: z.number().min(-30).max(10).optional(),
    binauralDb: z.number().min(-30).max(10).optional(),
  }),
});

// Audio job payload schema
export const AudioJobPayloadSchema = z.object({
  type: z.enum(["render", "preview", "export"]),
  projectData: z.object({
    scriptText: z.string().min(1).max(5000),
    voiceRef: z.string(),
    durationMin: z.number().int().min(5).max(15),
    pauseSec: z.number().int().min(1).max(30),
    loopMode: z.enum(["repeat", "interval"]),
    intervalSec: z.number().int().min(30).max(300).optional(),
    layers: AudioJobLayersSchema,
  }),
  outputOptions: z.object({
    format: z.enum(["mp3", "wav"]),
    quality: z.enum(["draft", "standard", "high"]).optional(),
    storageLocation: z.enum(["public", "private"]).optional(),
  }),
});

// Create audio job input schema
export const CreateAudioJobSchema = z.object({
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  priority: JobPrioritySchema.optional().default("normal"),
  payload: AudioJobPayloadSchema,
  metadata: z.record(z.unknown()).optional(),
});

// Job progress update schema
export const JobProgressUpdateSchema = z.object({
  jobId: z.string().uuid(),
  progress: z.number().int().min(0).max(100),
  message: z.string().optional(),
});

// Job result schema
export const JobResultSchema = z.object({
  jobId: z.string().uuid(),
  status: JobStatusSchema,
  outputUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
  error: z.object({
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }).optional(),
});

// Audio job queue schema (full database record)
export const AudioJobQueueSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  renderId: z.string().uuid().optional(),
  status: JobStatusSchema,
  priority: JobPrioritySchema,
  payload: AudioJobPayloadSchema,
  progress: z.number().int().min(0).max(100),
  progressMessage: z.string().optional(),
  createdAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  retryCount: z.number().int().min(0),
  maxRetries: z.number().int().min(0),
  errorMessage: z.string().optional(),
  errorDetails: z.record(z.unknown()).optional(),
  lockedAt: z.date().optional(),
  lockedBy: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Export type inference
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type JobPriority = z.infer<typeof JobPrioritySchema>;
export type AudioJobLayers = z.infer<typeof AudioJobLayersSchema>;
export type AudioJobPayload = z.infer<typeof AudioJobPayloadSchema>;
export type CreateAudioJob = z.infer<typeof CreateAudioJobSchema>;
export type JobProgressUpdate = z.infer<typeof JobProgressUpdateSchema>;
export type JobResult = z.infer<typeof JobResultSchema>;
export type AudioJobQueue = z.infer<typeof AudioJobQueueSchema>;