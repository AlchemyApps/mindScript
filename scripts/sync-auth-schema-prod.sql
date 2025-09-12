-- ============================================================================
-- Migration to sync production with new auth schema
-- This updates the existing profiles table to match the new auth structure
-- ============================================================================

-- First, drop existing constraints and indexes that might conflict
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
DROP INDEX IF EXISTS idx_profiles_display_name;
DROP INDEX IF EXISTS idx_profiles_stripe_customer;

-- Add new columns if they don't exist
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS role_flags JSONB DEFAULT '{"is_admin": false, "is_seller": false}'::JSONB;

-- Migrate data from old columns to new columns
UPDATE public.profiles 
SET 
  display_name = COALESCE(username, full_name, split_part(email, '@', 1)),
  role_flags = jsonb_build_object(
    'is_admin', false,
    'is_seller', COALESCE(is_premium, false)
  )
WHERE display_name IS NULL;

-- Drop old columns that are no longer needed
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS username,
  DROP COLUMN IF EXISTS full_name,
  DROP COLUMN IF EXISTS is_premium,
  DROP COLUMN IF EXISTS subscription_tier,
  DROP COLUMN IF EXISTS subscription_expires_at,
  DROP COLUMN IF EXISTS credits_remaining,
  DROP COLUMN IF EXISTS settings,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS last_login_at,
  DROP COLUMN IF EXISTS last_login_ip;

-- Add constraints
ALTER TABLE public.profiles 
  ADD CONSTRAINT display_name_length CHECK (char_length(display_name) <= 50),
  ADD CONSTRAINT bio_length CHECK (char_length(bio) <= 500),
  ADD CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Remove unique constraint from email (it should not be unique since it's from auth.users)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;

-- Create proper indexes
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name) WHERE display_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role_flags_seller ON public.profiles((role_flags->>'is_seller')) 
  WHERE (role_flags->>'is_seller')::boolean = true;

-- Now apply the rest of the auth schema (user_preferences and seller_agreements tables)

-- ============================================================================
-- User Preferences Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  notifications_enabled BOOLEAN DEFAULT true,
  email_updates BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  privacy_settings JSONB DEFAULT '{"profile_public": true, "show_purchases": false}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_preferences
CREATE POLICY "Users can view own preferences" 
  ON public.user_preferences FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
  ON public.user_preferences FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" 
  ON public.user_preferences FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences" 
  ON public.user_preferences FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- Seller Agreements Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.seller_agreements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  agreement_version TEXT NOT NULL DEFAULT '1.0',
  stripe_connect_id TEXT UNIQUE,
  onboarding_status TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'in_progress', 'completed', 'failed')),
  capabilities JSONB DEFAULT '{"transfers": false, "payouts": false}'::JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one agreement per user
  CONSTRAINT unique_user_agreement UNIQUE (user_id)
);

-- Create indexes
CREATE INDEX idx_seller_agreements_user ON public.seller_agreements(user_id);
CREATE INDEX idx_seller_agreements_stripe ON public.seller_agreements(stripe_connect_id) WHERE stripe_connect_id IS NOT NULL;
CREATE INDEX idx_seller_agreements_status ON public.seller_agreements(onboarding_status);

-- Enable RLS
ALTER TABLE public.seller_agreements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seller_agreements
CREATE POLICY "Users can view own seller agreement" 
  ON public.seller_agreements FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own seller agreement" 
  ON public.seller_agreements FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own seller agreement" 
  ON public.seller_agreements FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all seller agreements" 
  ON public.seller_agreements FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- ============================================================================
-- Updated At Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seller_agreements_updated_at 
  BEFORE UPDATE ON public.seller_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RLS Policies for profiles table (update existing)
-- ============================================================================

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Recreate policies with correct permissions
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- Automatic Profile Creation Function (Updated)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_display_name TEXT;
BEGIN
  -- Extract username from email (before @)
  default_display_name := split_part(NEW.email, '@', 1);
  
  -- Create profile
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, default_display_name)
  ON CONFLICT (id) DO NOTHING;
  
  -- Create default preferences
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Log the creation (if audit_logs exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      new_data,
      metadata
    ) VALUES (
      NEW.id,
      'CREATE',
      'profiles',
      NEW.id,
      jsonb_build_object('email', NEW.email, 'display_name', default_display_name),
      jsonb_build_object('trigger', 'handle_new_user', 'auto_created', true)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup (drop and recreate to ensure it's correct)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Profile Deletion Cleanup Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the deletion (if audit_logs exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      metadata
    ) VALUES (
      OLD.id,
      'DELETE',
      'profiles',
      OLD.id,
      to_jsonb(OLD),
      jsonb_build_object('trigger', 'handle_user_deletion', 'cascade_delete', true)
    );
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user deletion
DROP TRIGGER IF EXISTS on_profile_deleted ON public.profiles;
CREATE TRIGGER on_profile_deleted
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deletion();

-- ============================================================================
-- Storage Buckets for User Assets
-- ============================================================================

-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  false, -- Private bucket, we'll use signed URLs
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- Helper Views
-- ============================================================================

-- Public profile view (limited info)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  display_name,
  avatar_url,
  bio,
  created_at,
  (role_flags->>'is_seller')::boolean AS is_seller
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.profiles IS 'User profiles with public information';
COMMENT ON TABLE public.user_preferences IS 'Private user preferences and settings';
COMMENT ON TABLE public.seller_agreements IS 'Seller agreement acceptance and Stripe Connect status';
COMMENT ON COLUMN public.profiles.role_flags IS 'JSON flags for user roles: is_admin, is_seller';
COMMENT ON COLUMN public.seller_agreements.capabilities IS 'Stripe Connect capabilities: transfers, payouts';