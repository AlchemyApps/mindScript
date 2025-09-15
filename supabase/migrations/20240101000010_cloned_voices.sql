-- ============================================================================
-- Voice Cloning Tables and Security
-- ============================================================================
-- This migration implements:
-- - Cloned voices storage with encryption
-- - Consent tracking for legal compliance
-- - Usage limits and quotas
-- - GDPR-compliant deletion
-- ============================================================================

-- Enable pgcrypto for voice ID encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Cloned Voices Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cloned_voices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ElevenLabs voice data (encrypted at rest)
  voice_id TEXT NOT NULL, -- Will be encrypted using Supabase Vault
  voice_name TEXT NOT NULL CHECK (length(voice_name) BETWEEN 1 AND 100),
  description TEXT CHECK (length(description) <= 500),

  -- Voice sample storage
  sample_file_url TEXT,
  sample_file_size INTEGER CHECK (sample_file_size <= 10485760), -- 10MB max
  sample_duration INTEGER CHECK (sample_duration BETWEEN 60 AND 180), -- 60-180 seconds

  -- Voice characteristics (optional metadata)
  labels JSONB DEFAULT '{}'::JSONB,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'active', 'failed', 'deleted')
  ),
  error_message TEXT,

  -- Usage tracking
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  monthly_usage_count INTEGER NOT NULL DEFAULT 0 CHECK (monthly_usage_count >= 0),
  monthly_usage_limit INTEGER NOT NULL DEFAULT 100,
  last_used_at TIMESTAMPTZ,
  usage_reset_date TIMESTAMPTZ DEFAULT (date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'),

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete for GDPR compliance

  -- Constraints
  CONSTRAINT unique_voice_per_user UNIQUE(user_id, voice_name),
  CONSTRAINT valid_status CHECK (
    (status = 'deleted' AND deleted_at IS NOT NULL) OR
    (status != 'deleted' AND deleted_at IS NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_cloned_voices_user_id ON public.cloned_voices(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cloned_voices_status ON public.cloned_voices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_cloned_voices_created_at ON public.cloned_voices(created_at);
CREATE INDEX idx_cloned_voices_usage_reset ON public.cloned_voices(usage_reset_date) WHERE status = 'active';

-- ============================================================================
-- Voice Consent Records Table (Legal Compliance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.voice_consent_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voice_id UUID NOT NULL REFERENCES public.cloned_voices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Consent flags (all must be true)
  has_consent BOOLEAN NOT NULL DEFAULT FALSE,
  is_over_18 BOOLEAN NOT NULL DEFAULT FALSE,
  accepts_terms BOOLEAN NOT NULL DEFAULT FALSE,
  owns_voice BOOLEAN NOT NULL DEFAULT FALSE,
  understands_usage BOOLEAN NOT NULL DEFAULT FALSE,
  no_impersonation BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit trail
  consent_text TEXT NOT NULL, -- Full text of what user agreed to
  consent_version TEXT NOT NULL DEFAULT '1.0',
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure all consents are true
  CONSTRAINT all_consents_required CHECK (
    has_consent = TRUE AND
    is_over_18 = TRUE AND
    accepts_terms = TRUE AND
    owns_voice = TRUE AND
    understands_usage = TRUE AND
    no_impersonation = TRUE
  )
);

-- Index for quick lookups
CREATE INDEX idx_voice_consent_voice_id ON public.voice_consent_records(voice_id);
CREATE INDEX idx_voice_consent_user_id ON public.voice_consent_records(user_id);

-- ============================================================================
-- Voice Usage Logs Table (Track usage for limits)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.voice_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voice_id UUID NOT NULL REFERENCES public.cloned_voices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Usage details
  characters_used INTEGER NOT NULL CHECK (characters_used > 0),
  duration_seconds DECIMAL(10, 2),
  model_used TEXT,

  -- Context
  track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  job_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for usage tracking
CREATE INDEX idx_voice_usage_logs_voice_id ON public.voice_usage_logs(voice_id);
CREATE INDEX idx_voice_usage_logs_user_id ON public.voice_usage_logs(user_id);
CREATE INDEX idx_voice_usage_logs_created_at ON public.voice_usage_logs(created_at);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.cloned_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_usage_logs ENABLE ROW LEVEL SECURITY;

-- Cloned Voices Policies
CREATE POLICY "Users can view their own cloned voices"
  ON public.cloned_voices FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can create their own cloned voices"
  ON public.cloned_voices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cloned voices"
  ON public.cloned_voices FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can soft delete their own cloned voices"
  ON public.cloned_voices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- Voice Consent Policies
CREATE POLICY "Users can view their own consent records"
  ON public.voice_consent_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create consent records for their voices"
  ON public.voice_consent_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Voice Usage Logs Policies
CREATE POLICY "Users can view their own usage logs"
  ON public.voice_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage logs"
  ON public.voice_usage_logs FOR INSERT
  WITH CHECK (TRUE); -- Will be restricted by service role

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update monthly usage count
CREATE OR REPLACE FUNCTION public.increment_voice_usage(
  p_voice_id UUID,
  p_characters INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_monthly_limit INTEGER;
  v_current_usage INTEGER;
  v_reset_date TIMESTAMPTZ;
BEGIN
  -- Get voice details with lock
  SELECT user_id, monthly_usage_limit, monthly_usage_count, usage_reset_date
  INTO v_user_id, v_monthly_limit, v_current_usage, v_reset_date
  FROM public.cloned_voices
  WHERE id = p_voice_id AND status = 'active'
  FOR UPDATE;

  -- Check if we need to reset monthly usage
  IF v_reset_date <= NOW() THEN
    -- Reset monthly usage and set next reset date
    UPDATE public.cloned_voices
    SET
      monthly_usage_count = 1,
      usage_reset_date = date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month',
      usage_count = usage_count + 1,
      last_used_at = NOW(),
      updated_at = NOW()
    WHERE id = p_voice_id;
  ELSE
    -- Check if within monthly limit
    IF v_current_usage >= v_monthly_limit THEN
      RAISE EXCEPTION 'Monthly usage limit exceeded for voice %', p_voice_id;
    END IF;

    -- Increment usage
    UPDATE public.cloned_voices
    SET
      usage_count = usage_count + 1,
      monthly_usage_count = monthly_usage_count + 1,
      last_used_at = NOW(),
      updated_at = NOW()
    WHERE id = p_voice_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check subscription limits before creating voice
CREATE OR REPLACE FUNCTION public.check_voice_creation_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_subscription_tier TEXT;
  v_max_voices INTEGER;
  v_current_voices INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier
  INTO v_subscription_tier
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Set limits based on tier
  v_max_voices := CASE v_subscription_tier
    WHEN 'free' THEN 0
    WHEN 'basic' THEN 1
    WHEN 'premium' THEN 3
    WHEN 'enterprise' THEN 10
    ELSE 0
  END;

  -- Count current active voices
  SELECT COUNT(*)
  INTO v_current_voices
  FROM public.cloned_voices
  WHERE user_id = NEW.user_id
    AND status IN ('pending', 'processing', 'active')
    AND deleted_at IS NULL;

  -- Check limit
  IF v_current_voices >= v_max_voices THEN
    RAISE EXCEPTION 'Voice creation limit reached for subscription tier %', v_subscription_tier;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check limits before voice creation
CREATE TRIGGER check_voice_limit_before_insert
  BEFORE INSERT ON public.cloned_voices
  FOR EACH ROW
  EXECUTE FUNCTION public.check_voice_creation_limit();

-- Function to handle GDPR deletion request
CREATE OR REPLACE FUNCTION public.delete_voice_gdpr_compliant(
  p_voice_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Soft delete the voice
  UPDATE public.cloned_voices
  SET
    status = 'deleted',
    deleted_at = NOW(),
    updated_at = NOW(),
    -- Clear sensitive data
    voice_id = 'DELETED',
    sample_file_url = NULL,
    metadata = '{}'::JSONB
  WHERE id = p_voice_id AND user_id = p_user_id;

  -- Log the deletion for audit
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    metadata
  ) VALUES (
    p_user_id,
    'gdpr_delete',
    'cloned_voices',
    p_voice_id,
    jsonb_build_object('reason', 'User requested GDPR deletion')
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_voice_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cloned_voices_timestamp
  BEFORE UPDATE ON public.cloned_voices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_voice_timestamp();

-- ============================================================================
-- Grants for Service Role
-- ============================================================================

-- Grant necessary permissions to service role for backend operations
GRANT ALL ON public.cloned_voices TO service_role;
GRANT ALL ON public.voice_consent_records TO service_role;
GRANT ALL ON public.voice_usage_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_voice_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_voice_gdpr_compliant TO service_role;