import { z } from "zod";
import {
  UserIdSchema,
  TimestampsSchema,
  PaginationParamsSchema,
  StatusSchema,
} from "./common";
import { VoiceProviderSchema, AudioLayersSchema } from "./audio";

// Track status options
export const TrackStatusSchema = z.enum(["draft", "published", "archived"]);

// Base track schema
export const TrackSchema = z.object({
  id: z.string().uuid(),
  user_id: UserIdSchema,
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  script: z.string().min(10).max(5000),
  
  // Voice configuration
  voice_config: z.object({
    provider: VoiceProviderSchema,
    voice_id: z.string(),
    settings: z.record(z.any()).optional(),
  }),
  
  // Music configuration (optional)
  music_config: z.object({
    url: z.string().url().optional(),
    volume_db: z.number().min(-20).max(0).default(-10),
  }).optional(),
  
  // Frequency configuration (optional)
  frequency_config: z.object({
    solfeggio: z.object({
      frequency: z.number(),
      volume_db: z.number().min(-30).max(10),
    }).optional(),
    binaural: z.object({
      band: z.string(),
      volume_db: z.number().min(-30).max(10),
    }).optional(),
  }).optional(),
  
  // Output configuration
  output_config: z.object({
    format: z.enum(['mp3', 'wav']).default('mp3'),
    quality: z.enum(['standard', 'high']).default('standard'),
    is_public: z.boolean().default(false),
  }),
  
  status: TrackStatusSchema.default('draft'),
  is_public: z.boolean().default(false),
  tags: z.array(z.string()).max(10).default([]),
  render_job_id: z.string().uuid().optional(),
  audio_url: z.string().url().optional(),
  duration_seconds: z.number().int().min(0).optional(),
  play_count: z.number().int().min(0).default(0),
  price_cents: z.number().int().min(0).optional(),
  cover_image_url: z.string().url().nullable().optional(),
  deleted_at: z.string().datetime().optional(),
}).merge(TimestampsSchema);

// Create track schema
export const CreateTrackSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  script: z.string().min(10).max(5000),
  voice_config: z.object({
    provider: VoiceProviderSchema,
    voice_id: z.string(),
    settings: z.record(z.any()).optional(),
  }),
  music_config: z.object({
    url: z.string().url().optional(),
    volume_db: z.number().min(-20).max(0).default(-10),
  }).optional(),
  frequency_config: z.object({
    solfeggio: z.object({
      frequency: z.number(),
      volume_db: z.number().min(-30).max(10),
    }).optional(),
    binaural: z.object({
      band: z.string(),
      volume_db: z.number().min(-30).max(10),
    }).optional(),
  }).optional(),
  output_config: z.object({
    format: z.enum(['mp3', 'wav']).default('mp3'),
    quality: z.enum(['standard', 'high']).default('standard'),
    is_public: z.boolean().default(false),
  }),
  tags: z.array(z.string()).max(10).optional(),
});

// Update track schema (partial, only updatable fields)
export const UpdateTrackSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).max(10).optional(),
  is_public: z.boolean().optional(),
  status: TrackStatusSchema.optional(),
  cover_image_url: z.string().url().nullable().optional(),
});

// List tracks query parameters
export const ListTracksSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'published', 'archived', 'all']).optional(),
  owner_id: UserIdSchema.optional(),
  tags: z.array(z.string()).optional(),
  sort: z.enum(['created_at', 'updated_at', 'title', 'play_count', 'price']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  is_public: z.boolean().optional(),
});

// Track with owner info (for API responses)
export const TrackWithOwnerSchema = TrackSchema.extend({
  owner: z.object({
    id: UserIdSchema,
    display_name: z.string().optional(),
    avatar_url: z.string().url().optional(),
  }),
  render_status: StatusSchema.optional(),
});

// Paginated track response
export const PaginatedTracksSchema = z.object({
  data: z.array(TrackWithOwnerSchema),
  pagination: z.object({
    limit: z.number().int(),
    cursor: z.string().optional(),
    has_next: z.boolean(),
    has_prev: z.boolean(),
    total_count: z.number().int().optional(),
  }),
});

// Track validation function
export const validateTrackConfig = (track: z.infer<typeof CreateTrackSchema>) => {
  // Validate that binaural beats require stereo output
  if (track.frequency_config?.binaural && track.output_config?.format === 'mp3') {
    // This is fine for MP3 as it supports stereo
  }
  
  // Validate voice configuration
  if (!track.voice_config.voice_id || !track.voice_config.provider) {
    throw new Error("Voice configuration is required");
  }
  
  // Validate script length for TTS
  if (track.script.length > 5000) {
    throw new Error("Script too long for TTS processing");
  }
  
  return true;
};

// Export derived types
export type Track = z.infer<typeof TrackSchema>;
export type CreateTrack = z.infer<typeof CreateTrackSchema>;
export type UpdateTrack = z.infer<typeof UpdateTrackSchema>;
export type ListTracksQuery = z.infer<typeof ListTracksSchema>;
export type TrackWithOwner = z.infer<typeof TrackWithOwnerSchema>;
export type PaginatedTracks = z.infer<typeof PaginatedTracksSchema>;