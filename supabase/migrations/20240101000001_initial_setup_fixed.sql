-- ============================================================================
-- MindScript Security-First Database Setup (Fixed for Supabase)
-- ============================================================================
-- This migration implements comprehensive security controls including:
-- - Row Level Security (RLS) on all tables
-- - Secure defaults and constraints
-- - Audit logging
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Security Helper Functions (in public schema instead of auth)
-- ============================================================================

-- Function to get current user ID from JWT
CREATE OR REPLACE FUNCTION public.auth_user_id()
RETURNS UUID AS $$
  SELECT auth.uid()
$$ LANGUAGE SQL STABLE;

-- Function to check if user has role
CREATE OR REPLACE FUNCTION public.auth_has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    auth.jwt()->>'role' = role_name,
    FALSE
  )
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- Audit Log Table (before other tables for foreign keys)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);

-- RLS for audit logs - only admins can read
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.auth_has_role('admin'));

-- ============================================================================
-- User Profiles Table with Security
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'premium', 'enterprise')),
  subscription_expires_at TIMESTAMPTZ,
  credits_remaining INTEGER DEFAULT 0 CHECK (credits_remaining >= 0),
  settings JSONB DEFAULT '{}'::JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.auth_has_role('service_role'));

-- ============================================================================
-- Scripts Table with Security
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  tags TEXT[] DEFAULT '{}',
  is_template BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scripts_owner ON public.scripts(owner_id);
CREATE INDEX IF NOT EXISTS idx_scripts_public ON public.scripts(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_scripts_template ON public.scripts(is_template) WHERE is_template = TRUE;

-- RLS Policies
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scripts"
  ON public.scripts FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can view public scripts"
  ON public.scripts FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "Users can create their own scripts"
  ON public.scripts FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own scripts"
  ON public.scripts FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own scripts"
  ON public.scripts FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================================================
-- Audio Projects Table with Security
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audio_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  voice_ref TEXT NOT NULL,
  duration_min INTEGER NOT NULL CHECK (duration_min IN (5, 10, 15)),
  pause_sec INTEGER NOT NULL CHECK (pause_sec BETWEEN 1 AND 30),
  loop_mode TEXT NOT NULL CHECK (loop_mode IN ('repeat', 'interval')),
  interval_sec INTEGER CHECK (interval_sec BETWEEN 30 AND 300),
  bg_track_id UUID,
  layers_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  render_count INTEGER DEFAULT 0 CHECK (render_count >= 0),
  last_rendered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audio_projects_owner ON public.audio_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_audio_projects_script ON public.audio_projects(script_id);

-- RLS Policies
ALTER TABLE public.audio_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audio projects"
  ON public.audio_projects FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own audio projects"
  ON public.audio_projects FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own audio projects"
  ON public.audio_projects FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own audio projects"
  ON public.audio_projects FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================================================
-- Renders Table with Security
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.renders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.audio_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  output_url TEXT,
  duration_ms INTEGER CHECK (duration_ms > 0),
  file_size_bytes BIGINT CHECK (file_size_bytes > 0),
  channels INTEGER CHECK (channels IN (1, 2)),
  bitrate INTEGER CHECK (bitrate BETWEEN 64 AND 320),
  render_params_json JSONB NOT NULL,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_renders_project ON public.renders(project_id);
CREATE INDEX IF NOT EXISTS idx_renders_owner ON public.renders(owner_id);
CREATE INDEX IF NOT EXISTS idx_renders_status ON public.renders(status);

-- RLS Policies
ALTER TABLE public.renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own renders"
  ON public.renders FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create renders for their projects"
  ON public.renders FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id AND
    EXISTS (
      SELECT 1 FROM public.audio_projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );

-- ============================================================================
-- Webhook Events Table (for idempotency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'revenuecat', 'resend')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, event_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_type ON public.webhook_events(provider, event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed);

-- RLS - Only service role can access
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can manage webhook events"
  ON public.webhook_events FOR ALL
  USING (public.auth_has_role('service_role'));

-- ============================================================================
-- Payments Table with Security
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),
  product_type TEXT NOT NULL CHECK (product_type IN ('subscription', 'credits', 'one_time')),
  product_id TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- RLS Policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can create/update payments (from webhooks)
CREATE POLICY "Only service role can manage payments"
  ON public.payments FOR ALL
  USING (public.auth_has_role('service_role'));

-- ============================================================================
-- API Keys Table with Security
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE, -- Store hashed version only
  last_used_at TIMESTAMPTZ,
  last_used_ip INET,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON public.api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Storage Buckets (Run this part separately if it fails)
-- ============================================================================

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('audio-uploads', 'audio-uploads', false, 104857600, ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a']),
  ('audio-renders', 'audio-renders', false, 157286400, ARRAY['audio/mpeg', 'audio/wav']),
  ('background-music', 'background-music', false, 52428800, ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg']),
  ('thumbnails', 'thumbnails', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('published', 'published', true, 157286400, ARRAY['audio/mpeg', 'audio/wav']),
  ('previews', 'previews', true, 10485760, ARRAY['audio/mpeg', 'audio/wav'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Audit Triggers
-- ============================================================================

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_api_keys
  AFTER INSERT OR UPDATE OR DELETE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- Updated At Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audio_projects_updated_at BEFORE UPDATE ON public.audio_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_renders_updated_at BEFORE UPDATE ON public.renders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Security Indexes for Performance
-- ============================================================================

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON public.profiles(subscription_tier, subscription_expires_at);

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant permissions on tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.profiles IS 'User profiles with subscription and credit information';
COMMENT ON TABLE public.scripts IS 'User-created affirmation scripts';
COMMENT ON TABLE public.audio_projects IS 'Audio project configurations';
COMMENT ON TABLE public.renders IS 'Audio rendering jobs and outputs';
COMMENT ON TABLE public.webhook_events IS 'Webhook event tracking for idempotency';
COMMENT ON TABLE public.payments IS 'Payment records from Stripe';
COMMENT ON TABLE public.api_keys IS 'API keys for programmatic access';
COMMENT ON TABLE public.audit_logs IS 'Audit trail for security and compliance';

-- ============================================================================
-- End of Security Setup Migration
-- ============================================================================