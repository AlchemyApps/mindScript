import { z } from "zod";

// Brand type validators
export const UserIdSchema = z.string().uuid();
export const AudioProjectIdSchema = z.string().uuid();
export const RenderIdSchema = z.string().uuid();
export const ScriptIdSchema = z.string().uuid();
export const BackgroundTrackIdSchema = z.string().uuid();
export const VoiceIdSchema = z.string().uuid();
export const PublicationIdSchema = z.string().uuid();
export const PurchaseIdSchema = z.string().uuid();

// Common schemas
export const TimestampsSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PaginationParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int().min(1),
      limit: z.number().int().min(1),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0),
    }),
  });

// Status and platform enums
export const StatusSchema = z.enum([
  "pending",
  "processing", 
  "completed",
  "failed",
  "cancelled"
]);

export const PlatformSchema = z.enum(["web", "ios", "android"]);

// Error schema
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});