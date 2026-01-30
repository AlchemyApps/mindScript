-- ============================================================================
-- MindScript Combined Schema Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/byicqjniboevzbhbfxui/sql/new
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. Profiles Table (prerequisite for tracks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  role_flags JSONB DEFAULT '{"is_admin": false, "is_seller": false}'::JSONB,
  first_track_discount_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies (skip if exists)
DO $$ BEGIN
  CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access profiles" ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. Tracks Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  script TEXT NOT NULL,
  voice_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  music_config JSONB,
  frequency_config JSONB,
  output_config JSONB NOT NULL DEFAULT '{"format": "mp3", "quality": "standard", "is_public": false}'::JSONB,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'rendering', 'published', 'failed', 'archived')),
  is_public BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  render_job_id UUID,
  audio_url TEXT,
  duration_seconds INTEGER CHECK (duration_seconds >= 0),
  play_count INTEGER DEFAULT 0 CHECK (play_count >= 0),
  price_cents INTEGER CHECK (price_cents >= 0),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracks indexes
CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON public.tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_tracks_status ON public.tracks(status);
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON public.tracks(created_at DESC);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own tracks" ON public.tracks FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create own tracks" ON public.tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own tracks" ON public.tracks FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can view public tracks" ON public.tracks FOR SELECT USING (is_public = true AND deleted_at IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access tracks" ON public.tracks FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 3. Pending Tracks (for checkout flow)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pending_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id TEXT,
  title TEXT NOT NULL,
  script TEXT NOT NULL,
  voice_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  music_config JSONB,
  frequency_config JSONB,
  output_config JSONB DEFAULT '{"format": "mp3", "quality": "standard"}'::JSONB,
  stripe_checkout_session_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_tracks_user_id ON public.pending_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_tracks_session_id ON public.pending_tracks(session_id);
CREATE INDEX IF NOT EXISTS idx_pending_tracks_stripe_session ON public.pending_tracks(stripe_checkout_session_id);

ALTER TABLE public.pending_tracks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own pending tracks" ON public.pending_tracks FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create pending tracks" ON public.pending_tracks FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access pending_tracks" ON public.pending_tracks FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. Purchases Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  session_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT UNIQUE,
  amount_total INTEGER NOT NULL CHECK (amount_total >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_amount INTEGER CHECK (refund_amount >= 0),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_session_id ON public.purchases(session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON public.purchases(status);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access purchases" ON public.purchases FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 5. Track Access Table (THE KEY TABLE FOR LIBRARY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.track_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  session_id TEXT NOT NULL,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  access_type TEXT NOT NULL DEFAULT 'purchase' CHECK (access_type IN ('purchase', 'gift', 'promotion', 'owner'))
);

CREATE INDEX IF NOT EXISTS idx_track_access_user_id ON public.track_access(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_track_access_session_id ON public.track_access(session_id);
CREATE INDEX IF NOT EXISTS idx_track_access_track_id ON public.track_access(track_id);
CREATE INDEX IF NOT EXISTS idx_track_access_purchase_id ON public.track_access(purchase_id);

ALTER TABLE public.track_access ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own track access" ON public.track_access FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access track_access" ON public.track_access FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 6. Webhook Events (for idempotency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE,
  event_id TEXT,
  type TEXT NOT NULL,
  source TEXT DEFAULT 'stripe',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB,
  payload JSONB,
  status TEXT DEFAULT 'processed' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id ON public.webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events(type);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role only webhook_events" ON public.webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 7. Audio Jobs Queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audio_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  input_data JSONB NOT NULL,
  output_data JSONB,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_jobs_status ON public.audio_jobs(status);
CREATE INDEX IF NOT EXISTS idx_audio_jobs_track_id ON public.audio_jobs(track_id);
CREATE INDEX IF NOT EXISTS idx_audio_jobs_user_id ON public.audio_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_jobs_queued ON public.audio_jobs(priority DESC, created_at ASC) WHERE status = 'queued';

ALTER TABLE public.audio_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own audio jobs" ON public.audio_jobs FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access audio_jobs" ON public.audio_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 8. Updated At Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tracks_updated_at ON public.tracks;
CREATE TRIGGER update_tracks_updated_at BEFORE UPDATE ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pending_tracks_updated_at ON public.pending_tracks;
CREATE TRIGGER update_pending_tracks_updated_at BEFORE UPDATE ON public.pending_tracks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchases_updated_at ON public.purchases;
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_audio_jobs_updated_at ON public.audio_jobs;
CREATE TRIGGER update_audio_jobs_updated_at BEFORE UPDATE ON public.audio_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Done! Refresh the schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';

SELECT 'Migration completed successfully!' AS status;
