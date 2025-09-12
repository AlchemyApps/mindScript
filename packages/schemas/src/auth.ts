import { z } from "zod";
import { UserIdSchema, TimestampsSchema } from "./common";

// ============================================================================
// Validation Helpers
// ============================================================================

// Email validation with proper format
const emailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()
  .trim();

// Password validation with strength requirements
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Display name validation
const displayNameSchema = z
  .string()
  .min(2, 'Display name must be at least 2 characters')
  .max(50, 'Display name must be less than 50 characters')
  .trim();

// Bio validation
const bioSchema = z
  .string()
  .max(500, 'Bio must be less than 500 characters')
  .trim()
  .optional();

// ============================================================================
// Auth Session Schemas
// ============================================================================

export const AuthSessionSchema = z.object({
  id: z.string().uuid(),
  userId: UserIdSchema,
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime(),
  provider: z.enum(["email", "google", "apple", "github"]),
  metadata: z.record(z.unknown()).optional(),
}).merge(TimestampsSchema);

// ============================================================================
// Auth Request Schemas
// ============================================================================

export const SignUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema.optional(),
});

export const SignInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const ResetPasswordSchema = z.object({
  email: emailSchema,
});

export const UpdatePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: passwordSchema,
});

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

// ============================================================================
// OAuth Schemas
// ============================================================================

export const OAuthProviderSchema = z.enum(["google", "apple", "facebook", "github"]);

export const OAuthCallbackSchema = z.object({
  provider: OAuthProviderSchema,
  code: z.string(),
  state: z.string().optional(),
});

// ============================================================================
// Token Validation
// ============================================================================

export const TokenSchema = z.object({
  token: z.string(),
  type: z.enum(["access", "refresh", "magic"]),
});

// ============================================================================
// User Session & Profile Schemas
// ============================================================================

export const SessionUserSchema = z.object({
  id: UserIdSchema,
  email: z.string().email(),
  displayName: z.string().optional(),
  role: z.enum(["user", "seller", "admin"]),
  isEmailVerified: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
});

// Profile update schema
export const ProfileUpdateSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: bioSchema,
  avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
});

// User preferences schema
export const UserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('light'),
  notificationsEnabled: z.boolean().default(true),
  emailUpdates: z.boolean().default(true),
  language: z.string().default('en'),
  timezone: z.string().default('UTC'),
  privacySettings: z.object({
    profilePublic: z.boolean().default(true),
    showPurchases: z.boolean().default(false),
  }).default({
    profilePublic: true,
    showPurchases: false,
  }),
});

export const PreferencesUpdateSchema = UserPreferencesSchema.partial();

// ============================================================================
// Seller Agreement Schemas
// ============================================================================

export const SellerAgreementAcceptanceSchema = z.object({
  agreementVersion: z.string().min(1, 'Agreement version is required'),
  acceptedAt: z.string().datetime('Invalid datetime format').optional(),
});

export const StripeConnectOnboardingSchema = z.object({
  refreshUrl: z.string().url('Invalid refresh URL'),
  returnUrl: z.string().url('Invalid return URL'),
});

export const SellerAgreementUpdateSchema = z.object({
  stripeConnectId: z.string().optional(),
  onboardingStatus: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
  capabilities: z.object({
    transfers: z.boolean(),
    payouts: z.boolean(),
  }).optional(),
});

// ============================================================================
// Database Row Schemas (snake_case for Supabase)
// ============================================================================

export const ProfileRowSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  stripe_customer_id: z.string().nullable(),
  role_flags: z.object({
    is_admin: z.boolean().default(false),
    is_seller: z.boolean().default(false),
  }).default({
    is_admin: false,
    is_seller: false,
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const UserPreferencesRowSchema = z.object({
  user_id: z.string().uuid(),
  theme: z.enum(['light', 'dark', 'system']).default('light'),
  notifications_enabled: z.boolean().default(true),
  email_updates: z.boolean().default(true),
  language: z.string().default('en'),
  timezone: z.string().default('UTC'),
  privacy_settings: z.object({
    profile_public: z.boolean().default(true),
    show_purchases: z.boolean().default(false),
  }).default({
    profile_public: true,
    show_purchases: false,
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const SellerAgreementRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  accepted_at: z.string().datetime(),
  agreement_version: z.string(),
  stripe_connect_id: z.string().nullable(),
  onboarding_status: z.enum(['pending', 'in_progress', 'completed', 'failed']).default('pending'),
  capabilities: z.object({
    transfers: z.boolean().default(false),
    payouts: z.boolean().default(false),
  }).default({
    transfers: false,
    payouts: false,
  }),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;
export type PasswordResetRequest = z.infer<typeof ResetPasswordSchema>;
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type PreferencesUpdate = z.infer<typeof PreferencesUpdateSchema>;
export type SellerAgreementAcceptance = z.infer<typeof SellerAgreementAcceptanceSchema>;
export type StripeConnectOnboarding = z.infer<typeof StripeConnectOnboardingSchema>;
export type SellerAgreementUpdate = z.infer<typeof SellerAgreementUpdateSchema>;

// Database row types
export type ProfileRow = z.infer<typeof ProfileRowSchema>;
export type UserPreferencesRow = z.infer<typeof UserPreferencesRowSchema>;
export type SellerAgreementRow = z.infer<typeof SellerAgreementRowSchema>;