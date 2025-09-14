import { z } from "zod";
import {
  UserIdSchema,
  RenderIdSchema,
  PublicationIdSchema,
  TimestampsSchema,
  PaginationParamsSchema,
} from "./common";
import { SolfeggioFrequencySchema, BinauralBandSchema } from "./audio";

// Category enum (updated to match PRD)
export const CategorySchema = z.enum([
  "meditation",
  "sleep",
  "focus",
  "relaxation",
  "energy",
  "healing",
]);

// Publication status
export const PublicationStatusSchema = z.enum(["draft", "published", "unpublished"]);

// Price tier for native (iOS/Android)
export const PriceTierSchema = z.enum(["tier1", "tier2", "tier3", "tier4", "tier5"]);

// Publication schema
export const PublicationSchema = z.object({
  id: PublicationIdSchema,
  renderId: RenderIdSchema,
  sellerId: UserIdSchema,
  status: PublicationStatusSchema,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().optional(),
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  bgImageUrl: z.string().url().optional(),
  tags: z.array(z.string()).max(10),
  category: CategorySchema,
  language: z.string().length(2).default("en"), // ISO 639-1
  
  // Audio features for filtering
  hasVoice: z.boolean(),
  hasBackground: z.boolean(),
  hasSolfeggio: z.boolean(),
  hasBinaural: z.boolean(),
  solfeggioHz: SolfeggioFrequencySchema.optional(),
  binauralBand: BinauralBandSchema.optional(),
  durationMinutes: z.number().int().min(5).max(15),
  
  // Pricing
  priceWebCents: z.number().int().min(0),
  priceTierIos: PriceTierSchema,
  priceTierAndroid: PriceTierSchema,
  
  // Stats
  playCount: z.number().int().min(0).default(0),
  purchaseCount: z.number().int().min(0).default(0),
  rating: z.number().min(0).max(5).optional(),
  ratingCount: z.number().int().min(0).default(0),
  
  // SEO
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  keywords: z.array(z.string()).max(20),
}).merge(TimestampsSchema);

// Create/update publication schemas
export const CreatePublicationSchema = z.object({
  renderId: RenderIdSchema,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().optional(),
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  bgImageUrl: z.string().url().optional(),
  tags: z.array(z.string()).max(10),
  category: CategorySchema,
  language: z.string().length(2).default("en"),
  priceWebCents: z.number().int().min(99), // Minimum $0.99
  priceTierIos: PriceTierSchema,
  priceTierAndroid: PriceTierSchema,
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  keywords: z.array(z.string()).max(20),
});

export const UpdatePublicationSchema = CreatePublicationSchema.partial().extend({
  status: PublicationStatusSchema.optional(),
});

// Search/filter schemas
export const MarketplaceSearchSchema = z.object({
  query: z.string().optional(),
  category: CategorySchema.optional(),
  hasVoice: z.boolean().optional(),
  hasBackground: z.boolean().optional(),
  hasSolfeggio: z.boolean().optional(),
  hasBinaural: z.boolean().optional(),
  solfeggioHz: SolfeggioFrequencySchema.optional(),
  binauralBand: BinauralBandSchema.optional(),
  minDuration: z.number().int().min(5).max(15).optional(),
  maxDuration: z.number().int().min(5).max(15).optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  language: z.string().length(2).optional(),
  sellerId: UserIdSchema.optional(),
  sortBy: z.enum(["trending", "newest", "popular", "price_low", "price_high", "rating"]).optional(),
}).merge(PaginationParamsSchema);

// Feed types
export const FeedTypeSchema = z.enum(["trending", "for_you", "featured", "new"]);

// Marketplace-specific sort options
export const MarketplaceSortSchema = z.enum([
  "popular",
  "newest",
  "price_low",
  "price_high",
  "rating",
]);

// Seller badge types
export const SellerBadgeSchema = z.enum([
  "verified",
  "top_seller",
  "new",
]);

// Enhanced marketplace listing parameters
export const MarketplaceListingParamsSchema = z.object({
  // Pagination
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  
  // Search & filters
  search: z.string().max(100).optional(),
  category: CategorySchema.optional(),
  categories: z.array(CategorySchema).optional(),
  tags: z.array(z.string()).max(10).optional(),
  priceRange: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  }).optional(),
  durationRange: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  }).optional(),
  
  // Sorting
  sort: MarketplaceSortSchema.default("popular"),
  
  // Only show published tracks
  includePreview: z.boolean().default(false),
});

// Category with count for filters
export const CategoryWithCountSchema = z.object({
  name: CategorySchema,
  label: z.string(),
  count: z.number().int().min(0),
  icon: z.string().optional(),
});

// Paginated marketplace response
export const MarketplaceResponseSchema = z.object({
  tracks: z.array(PublicationSchema),
  pagination: z.object({
    cursor: z.string().optional(),
    has_next: z.boolean(),
    has_prev: z.boolean(),
    total_count: z.number().int().optional(),
  }),
  filters: z.object({
    categories: z.array(CategoryWithCountSchema),
    price_range: z.object({
      min: z.number(),
      max: z.number(),
    }),
    duration_range: z.object({
      min: z.number(),
      max: z.number(),
    }),
  }).optional(),
});

// Featured tracks response
export const FeaturedTracksSchema = z.object({
  featured: z.array(PublicationSchema),
  popular: z.array(PublicationSchema),
  new_releases: z.array(PublicationSchema),
});

// Review/rating schemas
export const CreateReviewSchema = z.object({
  publicationId: PublicationIdSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  publicationId: PublicationIdSchema,
  userId: UserIdSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  isVerifiedPurchase: z.boolean(),
}).merge(TimestampsSchema);

// Export types
export type MarketplaceCategory = z.infer<typeof CategorySchema>;
export type MarketplaceSort = z.infer<typeof MarketplaceSortSchema>;
export type MarketplaceListingParams = z.infer<typeof MarketplaceListingParamsSchema>;
export type MarketplaceResponse = z.infer<typeof MarketplaceResponseSchema>;
export type FeaturedTracks = z.infer<typeof FeaturedTracksSchema>;
export type CategoryWithCount = z.infer<typeof CategoryWithCountSchema>;
export type Publication = z.infer<typeof PublicationSchema>;

// Helper functions
export const formatPrice = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const getCategoryLabel = (category: MarketplaceCategory): string => {
  const labels: Record<MarketplaceCategory, string> = {
    meditation: "Meditation",
    sleep: "Sleep",
    focus: "Focus",
    relaxation: "Relaxation",
    energy: "Energy",
    healing: "Healing",
  };
  return labels[category];
};

export const getCategoryIcon = (category: MarketplaceCategory): string => {
  const icons: Record<MarketplaceCategory, string> = {
    meditation: "🧘",
    sleep: "😴",
    focus: "🎯",
    relaxation: "🌊",
    energy: "⚡",
    healing: "💚",
  };
  return icons[category];
};