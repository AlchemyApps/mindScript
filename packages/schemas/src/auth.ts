import { z } from "zod";
import { UserIdSchema, TimestampsSchema } from "./common";

// Auth session schema
export const AuthSessionSchema = z.object({
  id: z.string().uuid(),
  userId: UserIdSchema,
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime(),
  provider: z.enum(["email", "google", "apple"]),
  metadata: z.record(z.unknown()).optional(),
}).merge(TimestampsSchema);

// Auth request schemas
export const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  displayName: z.string().min(1).max(100).optional(),
});

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email(),
});

export const UpdatePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(100),
});

// OAuth schemas
export const OAuthProviderSchema = z.enum(["google", "apple", "facebook"]);

export const OAuthCallbackSchema = z.object({
  provider: OAuthProviderSchema,
  code: z.string(),
  state: z.string().optional(),
});

// Token validation
export const TokenSchema = z.object({
  token: z.string(),
  type: z.enum(["access", "refresh", "magic"]),
});

// User session info
export const SessionUserSchema = z.object({
  id: UserIdSchema,
  email: z.string().email(),
  displayName: z.string().optional(),
  role: z.enum(["user", "seller", "admin"]),
  isEmailVerified: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
});