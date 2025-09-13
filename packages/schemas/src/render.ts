import { z } from "zod";
import { UserIdSchema, TimestampsSchema, PaginationParamsSchema } from "./common";

// Render job status
export const RenderJobStatusSchema = z.enum([
  'pending',
  'processing', 
  'completed',
  'failed',
  'cancelled'
]);

// Render request schema (for POST /api/tracks/[id]/render)
export const RenderRequestSchema = z.object({
  quality: z.enum(['standard', 'high']).default('standard'),
  format: z.enum(['mp3', 'wav']).default('mp3'),
});

// Render status response schema (for GET /api/renders/[id]/status)
export const RenderStatusSchema = z.object({
  id: z.string().uuid(),
  track_id: z.string().uuid(),
  status: RenderJobStatusSchema,
  progress: z.number().min(0).max(100),
  stage: z.string().optional(),
  error: z.string().optional(),
  result: z.object({
    audio_url: z.string().url(),
    duration_seconds: z.number(),
    file_size_bytes: z.number(),
  }).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// List renders query parameters (for GET /api/renders)
export const ListRendersSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
  status: z.enum(['all', 'pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
  track_id: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

// Render with track info (for list response)
export const RenderWithTrackSchema = RenderStatusSchema.extend({
  track: z.object({
    id: z.string().uuid(),
    title: z.string(),
    duration_seconds: z.number().optional(),
  }),
});

// Paginated renders response
export const PaginatedRendersSchema = z.object({
  data: z.array(RenderWithTrackSchema),
  pagination: z.object({
    limit: z.number().int(),
    cursor: z.string().optional(),
    has_next: z.boolean(),
    has_prev: z.boolean(),
    total_count: z.number().int().optional(),
  }),
});

// Cancel render request (for POST /api/renders/[id]/cancel)
export const CancelRenderSchema = z.object({
  reason: z.string().max(255).optional(),
});

// Download options (for GET /api/tracks/[id]/download)
export const DownloadOptionsSchema = z.object({
  format: z.enum(['mp3', 'wav']).optional(),
  expires_in: z.number().min(300).max(3600).default(3600), // 5min to 1hour
});

// Rate limit configuration
export const RateLimitConfigSchema = z.object({
  render: z.object({
    window_ms: z.number().default(60 * 60 * 1000), // 1 hour
    max: z.number().default(5), // 5 renders per hour
  }).default({
    window_ms: 60 * 60 * 1000,
    max: 5,
  }),
  status: z.object({
    window_ms: z.number().default(60 * 1000), // 1 minute
    max: z.number().default(60), // 60 status checks per minute
  }).default({
    window_ms: 60 * 1000,
    max: 60,
  }),
});

// Export derived types
export type RenderJobStatus = z.infer<typeof RenderJobStatusSchema>;
export type RenderRequest = z.infer<typeof RenderRequestSchema>;
export type RenderStatus = z.infer<typeof RenderStatusSchema>;
export type ListRendersQuery = z.infer<typeof ListRendersSchema>;
export type RenderWithTrack = z.infer<typeof RenderWithTrackSchema>;
export type PaginatedRenders = z.infer<typeof PaginatedRendersSchema>;
export type CancelRender = z.infer<typeof CancelRenderSchema>;
export type DownloadOptions = z.infer<typeof DownloadOptionsSchema>;
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;