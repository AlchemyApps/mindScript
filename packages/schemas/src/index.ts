// Re-export all schemas - using wildcards where possible, explicit exports for conflicts

// Base exports (no conflicts)
export * from "./audio";
export * from "./auth";
export * from "./common";
export * from "./profile";
export * from "./queue";
export * from "./track";
export * from "./render";

// Cart exports (has CartItemSchema that checkout also has)
export * from "./cart";

// Checkout exports (excluding CartItemSchema since cart already exports it)
export {
  CreateCheckoutSessionRequestSchema,
  CheckoutSessionResponseSchema,
  PurchaseRecordSchema,
  PurchaseItemSchema,
  TrackAccessSchema,
  WebhookEventSchema,
  calculatePlatformFee,
  calculateSellerEarnings,
  type CreateCheckoutSessionRequest,
  type CheckoutSessionResponse,
  type PurchaseRecord,
  type PurchaseItem,
  type TrackAccess,
  type WebhookEvent,
} from "./checkout";

// Marketplace exports (CategorySchema conflicts with publish)
export * from "./marketplace";

// Publish exports (excluding CategorySchema and PricingConfigSchema due to conflicts)
export {
  VisibilitySchema,
  RenderStageSchema,
  PublishMetadataSchema,
  ValidateTrackSchema,
  PublishRequestSchema,
  RenderJobSubmissionSchema,
  RenderProgressSchema,
  TagSuggestionSchema,
  SuggestedTagsResponseSchema,
  // Rename the conflicting ones
  CategorySchema as PublishCategorySchema,
  PricingConfigSchema as PublishPricingConfigSchema,
  type Visibility,
  type RenderStage,
  type PublishMetadata,
  type ValidateTrack,
  type PublishRequest,
  type RenderJobSubmission,
  type RenderProgress,
  type TagSuggestion,
  type SuggestedTagsResponse,
  type Category as PublishCategory,
  type PricingConfig as PublishPricingConfig,
} from "./publish";

// Payments exports (PricingConfigSchema conflicts with publish but we renamed publish's version)
export * from "./payments";

// User exports (has SellerAgreementSchema that conflicts with seller)
export {
  UserRoleSchema,
  ProfileSchema,
  AppUserPreferencesSchema,
  // Rename to avoid conflict with seller
  SellerAgreementSchema as UserSellerAgreementSchema,
  UserVoiceSchema,
  UserProfileUpdateSchema,
  CreateUserVoiceSchema,
  UpdateUserVoiceSchema,
} from "./user";

// Seller exports (main source for SellerAgreementSchema)
export * from "./seller";

// Voice cloning exports
export * from "./voice-cloning";