import { z } from "zod";
import { UserIdSchema, TimestampsSchema } from "./common";

// User role enum
export const UserRoleSchema = z.enum(["user", "seller", "admin"]);

// Profile schema
export const ProfileSchema = z.object({
  id: UserIdSchema,
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  role: UserRoleSchema,
  stripeCustomerId: z.string().optional(),
  bio: z.string().max(500).optional(),
  profileImageUrl: z.string().url().optional(),
  headerImageUrl: z.string().url().optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isEmailVerified: z.boolean().default(false),
  onboardingCompleted: z.boolean().default(false),
}).merge(TimestampsSchema);

// User preferences
export const UserPreferencesSchema = z.object({
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  marketingEmails: z.boolean().default(false),
  autoplay: z.boolean().default(false),
  defaultVolume: z.number().min(0).max(100).default(70),
  defaultPlaybackSpeed: z.number().min(0.5).max(2).default(1),
});

// Seller agreement
export const SellerAgreementSchema = z.object({
  profileId: UserIdSchema,
  acceptedAt: z.string().datetime(),
  stripeConnectId: z.string().optional(),
  status: z.enum(["pending", "active", "suspended", "terminated"]),
  agreementVersion: z.string(),
  ipAddress: z.string().ip().optional(),
}).merge(TimestampsSchema);

// User voice (custom voice from ElevenLabs)
export const UserVoiceSchema = z.object({
  id: z.string().uuid(),
  ownerId: UserIdSchema,
  provider: z.literal("elevenlabs"),
  providerVoiceId: z.string(),
  title: z.string().min(1).max(100),
  previewUrl: z.string().url().optional(),
  setupFeePaid: z.boolean().default(false),
  active: z.boolean().default(true),
}).merge(TimestampsSchema);

// Update profile schema
export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  profileImageUrl: z.string().url().optional(),
  headerImageUrl: z.string().url().optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// Create/update user voice schemas
export const CreateUserVoiceSchema = z.object({
  title: z.string().min(1).max(100),
  consentAcknowledged: z.boolean(),
  audioSamples: z.array(z.string().url()).min(1).max(25), // ElevenLabs requires samples
});

export const UpdateUserVoiceSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
});