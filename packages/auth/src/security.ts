import crypto from 'crypto';
import { z } from 'zod';

/**
 * Security utilities for MindScript platform
 * Implements defense-in-depth security practices
 */

// ============================================================================
// Environment Variable Validation
// ============================================================================

const EnvironmentSchema = z.object({
  // Public variables (client-safe)
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  
  // Server-only secrets
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  OPENAI_API_KEY: z.string().startsWith('sk-').optional(),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
  
  // Security configuration
  SESSION_SECRET: z.string().min(32).optional(),
  JWT_SIGNING_KEY: z.string().min(64).optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  CSRF_SECRET: z.string().min(32).optional(),
});

export function validateEnvironment() {
  try {
    const env = EnvironmentSchema.parse(process.env);
    
    // Additional security checks
    if (process.env.NODE_ENV === 'production') {
      if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production');
      }
      if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
        throw new Error('SESSION_SECRET must be at least 32 characters in production');
      }
    }
    
    return env;
  } catch (error) {
    console.error('Environment validation failed:', error);
    throw new Error('Invalid environment configuration');
  }
}

// ============================================================================
// Webhook Signature Verification
// ============================================================================

/**
 * Verify Stripe webhook signature
 */
export function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const elements = signature.split(',');
  const timestamp = elements.find(e => e.startsWith('t='))?.substring(2);
  const signatures = elements
    .filter(e => e.startsWith('v1='))
    .map(e => e.substring(3));
  
  if (!timestamp || !signatures.length) {
    return false;
  }
  
  // Check timestamp to prevent replay attacks (5 minutes tolerance)
  const tolerance = 300; // 5 minutes
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > tolerance) {
    return false;
  }
  
  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  // Compare signatures (timing-safe)
  return signatures.some(sig => 
    crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expectedSignature)
    )
  );
}

/**
 * Verify RevenueCat webhook signature
 */
export function verifyRevenueCatWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Verify Resend webhook signature
 */
export function verifyResendWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// ============================================================================
// CSRF Protection
// ============================================================================

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(token: string, sessionToken: string): boolean {
  if (!token || !sessionToken) return false;
  
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(sessionToken)
  );
}

// ============================================================================
// Input Sanitization
// ============================================================================

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize file upload
 */
export function validateFileUpload(file: {
  name: string;
  type: string;
  size: number;
}): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const ALLOWED_AUDIO_TYPES = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/m4a',
  ];
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 100MB limit' };
  }
  
  // Check file type
  if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only audio files are allowed' };
  }
  
  // Check file name for path traversal
  if (file.name.includes('../') || file.name.includes('..\\')) {
    return { valid: false, error: 'Invalid file name' };
  }
  
  return { valid: true };
}

// ============================================================================
// Session Security
// ============================================================================

/**
 * Generate secure session ID
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hash sensitive data for storage
 */
export function hashSensitiveData(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512')
    .toString('hex');
  
  return `${actualSalt}:${hash}`;
}

/**
 * Verify hashed data
 */
export function verifyHashedData(data: string, hashedData: string): boolean {
  const [salt, hash] = hashedData.split(':');
  const verifyHash = crypto
    .pbkdf2Sync(data, salt, 100000, 64, 'sha512')
    .toString('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(verifyHash)
  );
}

// ============================================================================
// API Key Generation
// ============================================================================

/**
 * Generate secure API key
 */
export function generateAPIKey(prefix = 'msk'): string {
  const key = crypto.randomBytes(32).toString('base64url');
  return `${prefix}_${key}`;
}

// ============================================================================
// Encryption Utilities
// ============================================================================

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive data
 */
export function encryptData(text: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(key, 'hex'),
    iv
  );
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decryptData(encryptedData: string, key: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(key, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// ============================================================================
// Security Headers Helper
// ============================================================================

export function getSecurityHeaders() {
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
    ].join('; '),
  };
}

// ============================================================================
// Audit Logging
// ============================================================================

export interface AuditLog {
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export function createAuditLog(log: AuditLog): void {
  // In production, send to logging service (Sentry, Datadog, etc.)
  console.log('[AUDIT]', JSON.stringify({
    ...log,
    timestamp: log.timestamp.toISOString(),
  }));
}

// ============================================================================
// Export validation schemas for use in route handlers
// ============================================================================

export const AuthHeaderSchema = z.object({
  authorization: z.string().regex(/^Bearer .+$/),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const IdSchema = z.object({
  id: z.string().uuid(),
});

export const EmailSchema = z.object({
  email: z.string().email(),
});

// ============================================================================
// Security Utilities Exports
// ============================================================================

export default {
  validateEnvironment,
  verifyStripeWebhook,
  verifyRevenueCatWebhook,
  verifyResendWebhook,
  generateCSRFToken,
  verifyCSRFToken,
  sanitizeInput,
  validateFileUpload,
  generateSessionId,
  hashSensitiveData,
  verifyHashedData,
  generateAPIKey,
  encryptData,
  decryptData,
  getSecurityHeaders,
  createAuditLog,
};