import { z } from "zod";
import { UserIdSchema } from "./common";

// Cart item schema - represents a track in the cart
export const CartItemSchema = z.object({
  trackId: z.string().uuid(),
  title: z.string().min(1).max(255),
  artistName: z.string().min(1).max(255),
  artistId: UserIdSchema, // seller ID
  price: z.number().int().min(0), // in cents
  imageUrl: z.string().url().optional(),
  sellerId: UserIdSchema,
  sellerConnectAccountId: z.string().min(1),
  addedAt: z.date(),
  quantity: z.number().int().min(1).max(1).default(1), // Always 1 for digital tracks
});

// Cart state schema
export const CartStateSchema = z.object({
  items: z.array(CartItemSchema).max(10), // Maximum 10 items per cart
  sessionId: z.string().optional(), // For guest tracking
  lastSyncedAt: z.date().optional(),
  expiresAt: z.date().optional(), // Cart expiry after 7 days
});

// Cart API request schemas
export const AddToCartRequestSchema = z.object({
  trackId: z.string().uuid(),
  title: z.string().min(1).max(255),
  artistName: z.string().min(1).max(255),
  artistId: UserIdSchema,
  price: z.number().int().min(0),
  imageUrl: z.string().url().optional(),
  sellerId: UserIdSchema,
  sellerConnectAccountId: z.string().min(1),
});

export const RemoveFromCartRequestSchema = z.object({
  trackId: z.string().uuid(),
});

export const SyncCartRequestSchema = z.object({
  items: z.array(CartItemSchema),
  sessionId: z.string().optional(),
});

// Cart sync response
export const CartSyncResponseSchema = z.object({
  items: z.array(CartItemSchema),
  mergedCount: z.number().int().min(0),
  removedCount: z.number().int().min(0), // Items removed due to unavailability
  validationErrors: z.array(z.object({
    trackId: z.string().uuid(),
    reason: z.enum(["unavailable", "price_changed", "seller_inactive"]),
  })).optional(),
});

// Database cart item schema
export const DBCartItemSchema = z.object({
  id: z.string().uuid(),
  user_id: UserIdSchema.nullable(), // null for guests
  session_id: z.string(), // Always present for tracking
  track_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(1).default(1),
  added_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  expires_at: z.string().datetime(), // 7 days from last update
});

// Cart validation response
export const CartValidationResponseSchema = z.object({
  valid: z.boolean(),
  totalAmount: z.number().int().min(0), // Total in cents
  itemCount: z.number().int().min(0),
  errors: z.array(z.object({
    trackId: z.string().uuid(),
    error: z.string(),
  })).optional(),
});

// Types
export type CartItem = z.infer<typeof CartItemSchema>;
export type CartState = z.infer<typeof CartStateSchema>;
export type AddToCartRequest = z.infer<typeof AddToCartRequestSchema>;
export type RemoveFromCartRequest = z.infer<typeof RemoveFromCartRequestSchema>;
export type SyncCartRequest = z.infer<typeof SyncCartRequestSchema>;
export type CartSyncResponse = z.infer<typeof CartSyncResponseSchema>;
export type DBCartItem = z.infer<typeof DBCartItemSchema>;
export type CartValidationResponse = z.infer<typeof CartValidationResponseSchema>;

// Helper functions
export const calculateCartTotal = (items: CartItem[]): number => {
  return items.reduce((total, item) => total + (item.price * item.quantity), 0);
};

export const isCartExpired = (expiresAt?: Date): boolean => {
  if (!expiresAt) return false;
  return new Date() > expiresAt;
};

export const getCartExpiryDate = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 7); // 7 days from now
  return date;
};