import { z } from "zod";

// Category enum
export const CategorySchema = z.enum([
  'Meditation',
  'Sleep',
  'Focus',
  'Relaxation',
  'Energy',
  'Healing'
]);

// Visibility enum
export const VisibilitySchema = z.enum(['public', 'private']);

// Render stage enum
export const RenderStageSchema = z.enum([
  'preparing',
  'tts',
  'mixing',
  'normalizing',
  'uploading',
  'completed'
]);

// Track metadata schema for publishing
export const PublishMetadataSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-.,!?'"]+$/, 'Title contains invalid characters'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  tags: z.array(
    z.string()
      .min(1, 'Tag cannot be empty')
      .max(30, 'Tag must be less than 30 characters')
      .regex(/^[a-z0-9\-]+$/, 'Tags must be lowercase alphanumeric with hyphens')
  )
    .max(10, 'Maximum 10 tags allowed')
    .default([]),
  category: CategorySchema,
  visibility: VisibilitySchema,
});

// Pricing configuration schema
export const PricingConfigSchema = z.object({
  enableMarketplace: z.boolean().default(false),
  price: z.number()
    .min(0.99, 'Minimum price is $0.99')
    .max(49.99, 'Maximum price is $49.99')
    .multipleOf(0.01, 'Price must be in cents')
    .optional(),
  promotional: z.boolean().default(false),
  promotionalPrice: z.number()
    .min(0.99, 'Minimum promotional price is $0.99')
    .max(49.99, 'Maximum promotional price is $49.99')
    .multipleOf(0.01, 'Price must be in cents')
    .nullable()
    .optional(),
}).refine(
  (data) => {
    // If marketplace is enabled, price is required
    if (data.enableMarketplace && !data.price) {
      return false;
    }
    // If promotional is true, promotional price is required and must be less than regular price
    if (data.promotional) {
      if (!data.promotionalPrice) return false;
      if (data.price && data.promotionalPrice >= data.price) return false;
    }
    return true;
  },
  {
    message: 'Invalid pricing configuration',
  }
);

// Validation schema for track before publishing
export const ValidateTrackSchema = z.object({
  script: z.string()
    .min(10, 'Script must be at least 10 characters')
    .max(5000, 'Script must be less than 5000 characters'),
  voice_config: z.object({
    provider: z.enum(['openai', 'elevenlabs']),
    voice_id: z.string().min(1, 'Voice selection is required'),
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
});

// Publish request schema (combines everything)
export const PublishRequestSchema = z.object({
  metadata: PublishMetadataSchema,
  pricing: PricingConfigSchema,
  trackConfig: ValidateTrackSchema,
});

// Render job submission schema
export const RenderJobSubmissionSchema = z.object({
  track_id: z.string().uuid(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  notify_on_completion: z.boolean().default(true),
});

// Render progress update schema
export const RenderProgressSchema = z.object({
  job_id: z.string().uuid(),
  percentage: z.number().min(0).max(100),
  stage: RenderStageSchema,
  message: z.string(),
  estimated_time_remaining: z.number().optional(), // in seconds
  error: z.string().optional(),
});

// Tag suggestion schema
export const TagSuggestionSchema = z.object({
  category: CategorySchema,
  query: z.string().optional(),
});

export const SuggestedTagsResponseSchema = z.object({
  tags: z.array(z.object({
    value: z.string(),
    count: z.number(), // Number of tracks using this tag
    relevance: z.number().min(0).max(1), // Relevance score
  })),
});

// Export derived types
export type Category = z.infer<typeof CategorySchema>;
export type Visibility = z.infer<typeof VisibilitySchema>;
export type RenderStage = z.infer<typeof RenderStageSchema>;
export type PublishMetadata = z.infer<typeof PublishMetadataSchema>;
export type PricingConfig = z.infer<typeof PricingConfigSchema>;
export type ValidateTrack = z.infer<typeof ValidateTrackSchema>;
export type PublishRequest = z.infer<typeof PublishRequestSchema>;
export type RenderJobSubmission = z.infer<typeof RenderJobSubmissionSchema>;
export type RenderProgress = z.infer<typeof RenderProgressSchema>;
export type TagSuggestion = z.infer<typeof TagSuggestionSchema>;
export type SuggestedTagsResponse = z.infer<typeof SuggestedTagsResponseSchema>;