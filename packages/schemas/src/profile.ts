import { z } from 'zod'

// Username validation regex
const USERNAME_REGEX = /^[a-z][a-z0-9_-]{2,29}$/

// Profile theme enum
export const profileThemeSchema = z.enum(['light', 'dark', 'system'])
export type ProfileTheme = z.infer<typeof profileThemeSchema>

// Account status enum
export const accountStatusSchema = z.enum([
  'active',
  'suspended',
  'deleted',
  'pending_verification'
])
export type AccountStatus = z.infer<typeof accountStatusSchema>

// Notification settings schema
export const notificationSettingsSchema = z.object({
  marketing_emails: z.boolean().default(false),
  product_updates: z.boolean().default(true),
  security_alerts: z.boolean().default(true),
  newsletter: z.boolean().default(false),
  render_complete: z.boolean().default(true),
  payment_receipts: z.boolean().default(true)
})
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>

// Privacy settings schema
export const privacySettingsSchema = z.object({
  profile_visible: z.boolean().default(true),
  show_email: z.boolean().default(false),
  show_tracks: z.boolean().default(true),
  allow_messages: z.boolean().default(false),
  searchable: z.boolean().default(true)
})
export type PrivacySettings = z.infer<typeof privacySettingsSchema>

// Base profile schema (from database)
export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(USERNAME_REGEX, 'Username must start with a letter and contain only lowercase letters, numbers, underscores, and hyphens')
    .optional()
    .nullable(),
  display_name: z.string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters')
    .optional()
    .nullable(),
  bio: z.string()
    .max(500, 'Bio must be at most 500 characters')
    .optional()
    .nullable(),
  avatar_url: z.string().url().optional().nullable(),
  theme: profileThemeSchema.default('system'),
  notification_settings: notificationSettingsSchema.default({}),
  privacy_settings: privacySettingsSchema.default({}),
  account_status: accountStatusSchema.default('active'),
  email_verified: z.boolean().default(false),
  email_verified_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_login_at: z.string().datetime().optional().nullable(),
  stripe_customer_id: z.string().optional().nullable(),
  role_flags: z.record(z.boolean()).optional().nullable()
})
export type Profile = z.infer<typeof profileSchema>

// Public profile schema (limited fields for public viewing)
export const publicProfileSchema = profileSchema.pick({
  id: true,
  username: true,
  display_name: true,
  bio: true,
  avatar_url: true,
  created_at: true
})
export type PublicProfile = z.infer<typeof publicProfileSchema>

// Profile update schema (what users can update)
export const profileUpdateSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(USERNAME_REGEX, 'Username must start with a letter and contain only lowercase letters, numbers, underscores, and hyphens')
    .optional(),
  display_name: z.string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters')
    .optional(),
  bio: z.string()
    .max(500, 'Bio must be at most 500 characters')
    .optional(),
  avatar_url: z.string().url().optional().nullable(),
  theme: profileThemeSchema.optional(),
  notification_settings: notificationSettingsSchema.partial().optional(),
  privacy_settings: privacySettingsSchema.partial().optional()
})
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

// Settings update schema
export const settingsUpdateSchema = z.object({
  theme: profileThemeSchema.optional(),
  notification_settings: notificationSettingsSchema.partial().optional(),
  privacy_settings: privacySettingsSchema.partial().optional()
})
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>

// Avatar upload schema
export const avatarUploadSchema = z.object({
  file: z.instanceof(File)
    .refine(file => file.size <= 5 * 1024 * 1024, 'File size must be less than 5MB')
    .refine(
      file => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(file.type),
      'File must be an image (JPEG, PNG, WebP, or GIF)'
    )
})
export type AvatarUpload = z.infer<typeof avatarUploadSchema>

// Email change request schema
export const emailChangeRequestSchema = z.object({
  new_email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})
export type EmailChangeRequest = z.infer<typeof emailChangeRequestSchema>

// Password change request schema
export const passwordChangeRequestSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
})
export type PasswordChangeRequest = z.infer<typeof passwordChangeRequestSchema>

// Account deletion request schema
export const accountDeletionRequestSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  reason: z.string()
    .max(500, 'Reason must be at most 500 characters')
    .optional(),
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'You must confirm account deletion' })
  })
})
export type AccountDeletionRequest = z.infer<typeof accountDeletionRequestSchema>

// Username check schema
export const usernameCheckSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(USERNAME_REGEX, 'Invalid username format')
})
export type UsernameCheck = z.infer<typeof usernameCheckSchema>

// Profile completion calculation
export function calculateProfileCompletion(profile: Partial<Profile>): number {
  const fields = [
    profile.username,
    profile.display_name,
    profile.bio,
    profile.avatar_url,
    profile.email_verified
  ]
  
  const completed = fields.filter(Boolean).length
  return Math.round((completed / fields.length) * 100)
}

// Reserved usernames that cannot be used
export const RESERVED_USERNAMES = [
  'admin', 'api', 'app', 'auth', 'blog', 'cdn', 'dashboard', 
  'docs', 'help', 'login', 'logout', 'profile', 'settings',
  'signup', 'static', 'support', 'system', 'test', 'www',
  'mindscript', 'team', 'about', 'contact', 'privacy', 'terms',
  'u', 'user', 'users', 'me', 'self', 'root', 'null', 'undefined'
]

// Check if username is reserved
export function isUsernameReserved(username: string): boolean {
  return RESERVED_USERNAMES.includes(username.toLowerCase())
}

// Validate username format and availability
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' }
  }
  
  if (username.length > 30) {
    return { valid: false, error: 'Username must be at most 30 characters' }
  }
  
  if (!USERNAME_REGEX.test(username)) {
    return { 
      valid: false, 
      error: 'Username must start with a letter and contain only lowercase letters, numbers, underscores, and hyphens' 
    }
  }
  
  if (isUsernameReserved(username)) {
    return { valid: false, error: 'This username is reserved' }
  }
  
  return { valid: true }
}