import { describe, it, expect } from 'vitest'
import {
  profileSchema,
  profileUpdateSchema,
  avatarUploadSchema,
  emailChangeRequestSchema,
  passwordChangeRequestSchema,
  accountDeletionRequestSchema,
  usernameCheckSchema,
  validateUsername,
  isUsernameReserved,
  calculateProfileCompletion,
  RESERVED_USERNAMES
} from './profile'

describe('Profile Schemas', () => {
  describe('profileSchema', () => {
    it('validates a complete profile', () => {
      const profile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        username: 'johndoe',
        display_name: 'John Doe',
        bio: 'Software developer',
        avatar_url: 'https://example.com/avatar.jpg',
        theme: 'dark',
        notification_settings: {
          marketing_emails: false,
          product_updates: true,
          security_alerts: true,
          newsletter: false,
          render_complete: true,
          payment_receipts: true
        },
        privacy_settings: {
          profile_visible: true,
          show_email: false,
          show_tracks: true,
          allow_messages: false,
          searchable: true
        },
        account_status: 'active',
        email_verified: true,
        email_verified_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_login_at: '2024-01-01T00:00:00Z'
      }
      
      expect(profileSchema.parse(profile)).toEqual(profile)
    })

    it('validates minimal profile', () => {
      const minimalProfile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
      
      const parsed = profileSchema.parse(minimalProfile)
      expect(parsed.theme).toBe('system')
      expect(parsed.account_status).toBe('active')
      expect(parsed.email_verified).toBe(false)
    })

    it('rejects invalid email', () => {
      const invalidProfile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'invalid-email',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
      
      expect(() => profileSchema.parse(invalidProfile)).toThrow()
    })
  })

  describe('profileUpdateSchema', () => {
    it('validates partial updates', () => {
      const update = {
        display_name: 'New Name',
        bio: 'Updated bio'
      }
      
      expect(profileUpdateSchema.parse(update)).toEqual(update)
    })

    it('validates username format', () => {
      expect(() => profileUpdateSchema.parse({ username: 'valid_user-123' })).not.toThrow()
      expect(() => profileUpdateSchema.parse({ username: '123invalid' })).toThrow()
      expect(() => profileUpdateSchema.parse({ username: 'ab' })).toThrow()
      expect(() => profileUpdateSchema.parse({ username: 'a'.repeat(31) })).toThrow()
    })

    it('validates bio length', () => {
      const longBio = 'a'.repeat(501)
      expect(() => profileUpdateSchema.parse({ bio: longBio })).toThrow()
    })
  })

  describe('avatarUploadSchema', () => {
    it('validates valid image file', () => {
      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }) // 1MB
      
      expect(() => avatarUploadSchema.parse({ file })).not.toThrow()
    })

    it('rejects oversized file', () => {
      const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 }) // 6MB
      
      expect(() => avatarUploadSchema.parse({ file })).toThrow('File size must be less than 5MB')
    })

    it('rejects non-image file', () => {
      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' })
      Object.defineProperty(file, 'size', { value: 1024 })
      
      expect(() => avatarUploadSchema.parse({ file })).toThrow('File must be an image')
    })
  })

  describe('emailChangeRequestSchema', () => {
    it('validates email change request', () => {
      const request = {
        new_email: 'newemail@example.com',
        password: 'currentpassword'
      }
      
      expect(emailChangeRequestSchema.parse(request)).toEqual(request)
    })

    it('rejects invalid email', () => {
      const request = {
        new_email: 'invalid-email',
        password: 'password'
      }
      
      expect(() => emailChangeRequestSchema.parse(request)).toThrow('Invalid email address')
    })

    it('requires password', () => {
      const request = {
        new_email: 'valid@example.com',
        password: ''
      }
      
      expect(() => emailChangeRequestSchema.parse(request)).toThrow('Password is required')
    })
  })

  describe('passwordChangeRequestSchema', () => {
    it('validates strong password', () => {
      const request = {
        current_password: 'oldpassword',
        new_password: 'NewPass123'
      }
      
      expect(passwordChangeRequestSchema.parse(request)).toEqual(request)
    })

    it('rejects weak passwords', () => {
      expect(() => passwordChangeRequestSchema.parse({
        current_password: 'old',
        new_password: 'short'
      })).toThrow('at least 8 characters')

      expect(() => passwordChangeRequestSchema.parse({
        current_password: 'old',
        new_password: 'nocapital123'
      })).toThrow('uppercase letter')

      expect(() => passwordChangeRequestSchema.parse({
        current_password: 'old',
        new_password: 'NOLOWER123'
      })).toThrow('lowercase letter')

      expect(() => passwordChangeRequestSchema.parse({
        current_password: 'old',
        new_password: 'NoNumbers'
      })).toThrow('one number')
    })
  })

  describe('accountDeletionRequestSchema', () => {
    it('validates deletion request', () => {
      const request = {
        password: 'password',
        reason: 'No longer needed',
        confirm: true as const
      }
      
      expect(accountDeletionRequestSchema.parse(request)).toEqual(request)
    })

    it('requires confirmation', () => {
      const request = {
        password: 'password',
        confirm: false
      }
      
      expect(() => accountDeletionRequestSchema.parse(request)).toThrow('must confirm')
    })
  })

  describe('usernameCheckSchema', () => {
    it('validates username format', () => {
      expect(usernameCheckSchema.parse({ username: 'validuser' })).toEqual({ username: 'validuser' })
      expect(usernameCheckSchema.parse({ username: 'user_123' })).toEqual({ username: 'user_123' })
      expect(usernameCheckSchema.parse({ username: 'user-name' })).toEqual({ username: 'user-name' })
    })

    it('rejects invalid usernames', () => {
      expect(() => usernameCheckSchema.parse({ username: '123' })).toThrow()
      expect(() => usernameCheckSchema.parse({ username: '_invalid' })).toThrow()
      expect(() => usernameCheckSchema.parse({ username: 'ab' })).toThrow()
    })
  })

  describe('validateUsername', () => {
    it('validates correct usernames', () => {
      expect(validateUsername('validuser')).toEqual({ valid: true })
      expect(validateUsername('user123')).toEqual({ valid: true })
      expect(validateUsername('user_name')).toEqual({ valid: true })
      expect(validateUsername('user-name')).toEqual({ valid: true })
    })

    it('rejects invalid formats', () => {
      expect(validateUsername('123user')).toEqual({
        valid: false,
        error: expect.stringContaining('must start with a letter')
      })
      expect(validateUsername('_user')).toEqual({
        valid: false,
        error: expect.stringContaining('must start with a letter')
      })
      expect(validateUsername('user name')).toEqual({
        valid: false,
        error: expect.stringContaining('must start with a letter')
      })
    })

    it('rejects too short or too long usernames', () => {
      expect(validateUsername('ab')).toEqual({
        valid: false,
        error: 'Username must be at least 3 characters'
      })
      expect(validateUsername('a'.repeat(31))).toEqual({
        valid: false,
        error: 'Username must be at most 30 characters'
      })
    })

    it('rejects reserved usernames', () => {
      expect(validateUsername('admin')).toEqual({
        valid: false,
        error: 'This username is reserved'
      })
      expect(validateUsername('api')).toEqual({
        valid: false,
        error: 'This username is reserved'
      })
    })
  })

  describe('isUsernameReserved', () => {
    it('identifies reserved usernames', () => {
      RESERVED_USERNAMES.forEach(username => {
        expect(isUsernameReserved(username)).toBe(true)
      })
    })

    it('identifies non-reserved usernames', () => {
      expect(isUsernameReserved('johndoe')).toBe(false)
      expect(isUsernameReserved('user123')).toBe(false)
      expect(isUsernameReserved('myusername')).toBe(false)
    })

    it('is case-insensitive', () => {
      expect(isUsernameReserved('ADMIN')).toBe(true)
      expect(isUsernameReserved('Admin')).toBe(true)
      expect(isUsernameReserved('aDmIn')).toBe(true)
    })
  })

  describe('calculateProfileCompletion', () => {
    it('calculates 0% for empty profile', () => {
      expect(calculateProfileCompletion({})).toBe(0)
    })

    it('calculates 100% for complete profile', () => {
      const profile = {
        username: 'johndoe',
        display_name: 'John Doe',
        bio: 'Developer',
        avatar_url: 'https://example.com/avatar.jpg',
        email_verified: true
      }
      expect(calculateProfileCompletion(profile)).toBe(100)
    })

    it('calculates partial completion', () => {
      const profile = {
        username: 'johndoe',
        display_name: 'John Doe',
        email_verified: true
      }
      expect(calculateProfileCompletion(profile)).toBe(60) // 3 out of 5 fields
    })
  })
})