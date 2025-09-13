-- Migration: User Profile Management System Extensions
-- Phase 2.1.4: Enhanced user profiles with complete management features
-- Description: Adds username, theme preferences, notification settings, privacy controls,
--              account status tracking, email verification, and improved audit capabilities

-- ============================================================================
-- STEP 1: Extend profiles table with new fields
-- ============================================================================

-- Add theme preference (light/dark/system)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system'
  CHECK (theme IN ('light', 'dark', 'system'));

-- Add notification settings as structured JSONB
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT jsonb_build_object(
  'email_marketing', true,
  'email_updates', true,
  'email_security', true,
  'push_enabled', false,
  'render_complete', true,
  'purchase_receipts', true,
  'weekly_digest', false
);

-- Add privacy settings as structured JSONB
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT jsonb_build_object(
  'profile_visibility', 'public',  -- public, private, friends
  'show_email', false,
  'show_purchases', false,
  'show_projects', true,
  'allow_messages', true,
  'searchable', true
);

-- Add account status tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active'
  CHECK (account_status IN ('active', 'suspended', 'deleted', 'pending_verification'));

-- Add email verification tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Add deletion tracking (soft delete support)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Add suspension tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS suspension_expires_at TIMESTAMPTZ;

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

-- Username index for fast lookups (already exists as unique constraint)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;

-- Account status index for filtering active users
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);

-- Email verification index for finding unverified accounts
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON public.profiles(email_verified) 
  WHERE email_verified = false;

-- Deleted accounts index for exclusion queries
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at) 
  WHERE deleted_at IS NULL;

-- Last login index for activity tracking (if column exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'profiles' 
             AND column_name = 'last_login_at') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at ON public.profiles(last_login_at);
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add username validation function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_username(username_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Username must be 3-30 characters
  IF char_length(username_input) < 3 OR char_length(username_input) > 30 THEN
    RETURN false;
  END IF;
  
  -- Username must start with a letter
  IF NOT (username_input ~ '^[a-zA-Z]') THEN
    RETURN false;
  END IF;
  
  -- Username can only contain letters, numbers, underscores, and hyphens
  IF NOT (username_input ~ '^[a-zA-Z][a-zA-Z0-9_-]*$') THEN
    RETURN false;
  END IF;
  
  -- Username cannot have consecutive special characters
  IF username_input ~ '[_-]{2,}' THEN
    RETURN false;
  END IF;
  
  -- Reserved usernames check
  IF username_input = ANY(ARRAY[
    'admin', 'api', 'app', 'auth', 'blog', 'cdn', 'help', 'mail', 
    'root', 'status', 'support', 'www', 'mindscript', 'system'
  ]) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add username validation constraint
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_username_valid;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_valid 
  CHECK (username IS NULL OR public.validate_username(username));

-- ============================================================================
-- STEP 4: Create trigger for username normalization
-- ============================================================================

CREATE OR REPLACE FUNCTION public.normalize_username()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    -- Convert to lowercase for consistency
    NEW.username := lower(NEW.username);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_username_trigger ON public.profiles;

CREATE TRIGGER normalize_username_trigger
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_username();

-- ============================================================================
-- STEP 5: Update audit trigger for new fields
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Track significant profile changes
  IF TG_OP = 'UPDATE' THEN
    -- Log account status changes
    IF OLD.account_status IS DISTINCT FROM NEW.account_status THEN
      INSERT INTO public.audit_logs (
        user_id, action, table_name, record_id, 
        old_data, new_data, metadata
      ) VALUES (
        NEW.id, 
        'account_status_change', 
        'profiles', 
        NEW.id,
        jsonb_build_object('account_status', OLD.account_status),
        jsonb_build_object('account_status', NEW.account_status),
        jsonb_build_object('reason', COALESCE(NEW.suspension_reason, NEW.deletion_reason))
      );
    END IF;
    
    -- Log email verification
    IF OLD.email_verified IS DISTINCT FROM NEW.email_verified AND NEW.email_verified = true THEN
      INSERT INTO public.audit_logs (
        user_id, action, table_name, record_id, metadata
      ) VALUES (
        NEW.id, 
        'email_verified', 
        'profiles', 
        NEW.id,
        jsonb_build_object('verified_at', NEW.email_verified_at)
      );
    END IF;
    
    -- Log username changes
    IF OLD.username IS DISTINCT FROM NEW.username THEN
      INSERT INTO public.audit_logs (
        user_id, action, table_name, record_id,
        old_data, new_data
      ) VALUES (
        NEW.id,
        'username_change',
        'profiles',
        NEW.id,
        jsonb_build_object('username', OLD.username),
        jsonb_build_object('username', NEW.username)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_profile_changes_trigger ON public.profiles;

CREATE TRIGGER audit_profile_changes_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_profile_changes();

-- ============================================================================
-- STEP 6: Enhanced RLS Policies
-- ============================================================================

-- Drop existing policies to recreate with new logic
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by all" ON public.profiles;
DROP POLICY IF EXISTS "Service role has full access" ON public.profiles;

-- Policy: Users can always view their own complete profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Public profiles viewable based on privacy settings
CREATE POLICY "Public profiles viewable with privacy"
  ON public.profiles FOR SELECT
  USING (
    -- Not the user's own profile
    auth.uid() != id
    -- Account must be active
    AND account_status = 'active'
    -- Not deleted
    AND deleted_at IS NULL
    -- Profile must be public
    AND (privacy_settings->>'profile_visibility' = 'public' 
         OR privacy_settings->>'profile_visibility' IS NULL)
  );

-- Policy: Users can update their own profile with restrictions
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (
    auth.uid() = id 
    AND account_status IN ('active', 'pending_verification')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    auth.uid() = id 
    AND account_status IN ('active', 'pending_verification')
    AND deleted_at IS NULL
  );

-- Policy: Service role bypass for admin operations
CREATE POLICY "Service role has full access"
  ON public.profiles FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- STEP 6.5: Create trigger to prevent updating sensitive fields
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_sensitive_field_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if not service role
  IF auth.role() != 'service_role' THEN
    -- Check each sensitive field
    IF OLD.email IS DISTINCT FROM NEW.email THEN
      RAISE EXCEPTION 'Cannot directly update email field';
    END IF;
    
    IF OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id THEN
      RAISE EXCEPTION 'Cannot directly update stripe_customer_id';
    END IF;
    
    IF OLD.role_flags IS DISTINCT FROM NEW.role_flags THEN
      RAISE EXCEPTION 'Cannot directly update role_flags';
    END IF;
    
    IF OLD.is_premium IS DISTINCT FROM NEW.is_premium THEN
      RAISE EXCEPTION 'Cannot directly update is_premium';
    END IF;
    
    IF OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN
      RAISE EXCEPTION 'Cannot directly update subscription_tier';
    END IF;
    
    IF OLD.subscription_expires_at IS DISTINCT FROM NEW.subscription_expires_at THEN
      RAISE EXCEPTION 'Cannot directly update subscription_expires_at';
    END IF;
    
    IF OLD.credits_remaining IS DISTINCT FROM NEW.credits_remaining THEN
      RAISE EXCEPTION 'Cannot directly update credits_remaining';
    END IF;
    
    IF OLD.account_status IS DISTINCT FROM NEW.account_status THEN
      RAISE EXCEPTION 'Cannot directly update account_status';
    END IF;
    
    IF OLD.email_verified IS DISTINCT FROM NEW.email_verified THEN
      RAISE EXCEPTION 'Cannot directly update email_verified';
    END IF;
    
    IF OLD.email_verified_at IS DISTINCT FROM NEW.email_verified_at THEN
      RAISE EXCEPTION 'Cannot directly update email_verified_at';
    END IF;
    
    IF OLD.suspended_at IS DISTINCT FROM NEW.suspended_at THEN
      RAISE EXCEPTION 'Cannot directly update suspended_at';
    END IF;
    
    IF OLD.suspension_reason IS DISTINCT FROM NEW.suspension_reason THEN
      RAISE EXCEPTION 'Cannot directly update suspension_reason';
    END IF;
    
    IF OLD.suspension_expires_at IS DISTINCT FROM NEW.suspension_expires_at THEN
      RAISE EXCEPTION 'Cannot directly update suspension_expires_at';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_sensitive_field_updates_trigger ON public.profiles;

CREATE TRIGGER prevent_sensitive_field_updates_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_sensitive_field_updates();

-- ============================================================================
-- STEP 7: Update user_preferences table RLS
-- ============================================================================

-- Ensure user_preferences policies respect account status
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;

CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = user_id 
      AND account_status != 'deleted'
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = user_id 
      AND account_status = 'active'
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = user_id 
      AND account_status = 'active'
      AND deleted_at IS NULL
    )
  );

-- ============================================================================
-- STEP 8: Account deletion cascade function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_user_account(user_id UUID, reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  -- Update profile to mark as deleted
  UPDATE public.profiles
  SET 
    account_status = 'deleted',
    deleted_at = NOW(),
    deletion_reason = reason,
    -- Anonymize sensitive data
    email = 'deleted_' || substring(md5(random()::text), 1, 10) || '@deleted.local',
    username = NULL,
    display_name = 'Deleted User',
    bio = NULL,
    avatar_url = NULL,
    stripe_customer_id = NULL,
    notification_settings = '{}'::jsonb,
    privacy_settings = jsonb_build_object('profile_visibility', 'private'),
    settings = '{}'::jsonb,
    metadata = jsonb_build_object('deleted_at', NOW())
  WHERE id = user_id;
  
  -- Anonymize user scripts
  UPDATE public.scripts
  SET 
    title = 'Deleted Script',
    content = 'This content has been removed.',
    tags = ARRAY[]::text[],
    is_public = false,
    is_template = false
  WHERE owner_id = user_id;
  
  -- Cancel any pending renders
  UPDATE public.renders
  SET 
    status = 'cancelled',
    error_message = 'User account deleted'
  WHERE owner_id = user_id AND status IN ('pending', 'processing');
  
  -- Deactivate API keys
  UPDATE public.api_keys
  SET is_active = false
  WHERE user_id = user_id;
  
  -- Log the deletion
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, metadata
  ) VALUES (
    user_id,
    'account_deleted',
    'profiles',
    user_id,
    jsonb_build_object('reason', reason, 'deleted_at', NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 9: Create storage bucket for avatars if not exists
-- ============================================================================

-- Note: Storage bucket creation requires using Supabase Dashboard or CLI
-- This is just documentation of the required bucket configuration:

-- Bucket: avatars
-- Public: false (use signed URLs)
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
-- 
-- RLS Policies needed:
-- 1. Users can upload their own avatar
-- 2. Users can update their own avatar
-- 3. Users can delete their own avatar
-- 4. Public read with signed URLs

-- ============================================================================
-- STEP 10: Add helper function for profile completion percentage
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_profile_completion(profile_id UUID)
RETURNS INTEGER AS $$
DECLARE
  completion_score INTEGER := 0;
  profile_record RECORD;
BEGIN
  SELECT * INTO profile_record FROM public.profiles WHERE id = profile_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Basic information (50%)
  IF profile_record.username IS NOT NULL THEN
    completion_score := completion_score + 15;
  END IF;
  
  IF profile_record.display_name IS NOT NULL THEN
    completion_score := completion_score + 10;
  END IF;
  
  IF profile_record.bio IS NOT NULL AND char_length(profile_record.bio) > 20 THEN
    completion_score := completion_score + 15;
  END IF;
  
  IF profile_record.avatar_url IS NOT NULL THEN
    completion_score := completion_score + 10;
  END IF;
  
  -- Verification (20%)
  IF profile_record.email_verified = true THEN
    completion_score := completion_score + 20;
  END IF;
  
  -- Preferences (15%)
  IF profile_record.theme IS NOT NULL THEN
    completion_score := completion_score + 5;
  END IF;
  
  IF profile_record.notification_settings IS NOT NULL THEN
    completion_score := completion_score + 5;
  END IF;
  
  IF profile_record.privacy_settings IS NOT NULL THEN
    completion_score := completion_score + 5;
  END IF;
  
  -- Activity (15%) - Check if last_login_at column exists
  BEGIN
    IF profile_record.last_login_at IS NOT NULL 
       AND profile_record.last_login_at > NOW() - INTERVAL '30 days' THEN
      completion_score := completion_score + 15;
    END IF;
  EXCEPTION
    WHEN undefined_column THEN
      -- Column doesn't exist, skip this check
      NULL;
  END;
  
  RETURN LEAST(completion_score, 100);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- STEP 11: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.profiles.theme IS 'User interface theme preference';
COMMENT ON COLUMN public.profiles.notification_settings IS 'Granular notification preferences';
COMMENT ON COLUMN public.profiles.privacy_settings IS 'Privacy and visibility controls';
COMMENT ON COLUMN public.profiles.account_status IS 'Current account status for access control';
COMMENT ON COLUMN public.profiles.email_verified IS 'Whether email address has been verified';
COMMENT ON COLUMN public.profiles.email_verified_at IS 'Timestamp of email verification';
COMMENT ON COLUMN public.profiles.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN public.profiles.deletion_reason IS 'Reason for account deletion';
COMMENT ON COLUMN public.profiles.suspended_at IS 'Account suspension timestamp';
COMMENT ON COLUMN public.profiles.suspension_reason IS 'Reason for account suspension';
COMMENT ON COLUMN public.profiles.suspension_expires_at IS 'When suspension automatically lifts';

COMMENT ON FUNCTION public.validate_username IS 'Validates username format and reserved names';
COMMENT ON FUNCTION public.normalize_username IS 'Normalizes username to lowercase';
COMMENT ON FUNCTION public.audit_profile_changes IS 'Tracks significant profile changes';
COMMENT ON FUNCTION public.soft_delete_user_account IS 'Performs soft delete with data anonymization';
COMMENT ON FUNCTION public.calculate_profile_completion IS 'Calculates profile completion percentage';

-- ============================================================================
-- Migration complete
-- ============================================================================