-- ============================================================================
-- Reactive Moderation System (Fixed)
-- ============================================================================
-- Purpose: Community-driven content moderation with reports, actions, and appeals
-- Principle: Trust by default, moderate on reports

-- ============================================================================
-- Enums
-- ============================================================================

-- Report categories for different types of issues
DO $$ BEGIN
  CREATE TYPE report_category AS ENUM (
    'inappropriate_content',
    'offensive_language',
    'copyright_violation',
    'spam',
    'scam_fraud',
    'misleading_content',
    'harassment',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Content types that can be reported
DO $$ BEGIN
  CREATE TYPE reportable_content_type AS ENUM (
    'track',
    'profile',
    'seller_listing',
    'review',
    'comment'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Status of a report
DO $$ BEGIN
  CREATE TYPE report_status AS ENUM (
    'pending',
    'under_review',
    'actioned',
    'dismissed',
    'auto_dismissed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Actions that can be taken on reported content
DO $$ BEGIN
  CREATE TYPE moderation_action_type AS ENUM (
    'no_action',
    'warning_issued',
    'content_removed',
    'marketplace_delisted',
    'user_suspended',
    'user_banned'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Appeal status
DO $$ BEGIN
  CREATE TYPE appeal_status AS ENUM (
    'pending',
    'under_review',
    'granted',
    'denied'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- Tables
-- ============================================================================

-- Content reports from users
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What is being reported
  content_type reportable_content_type NOT NULL,
  content_id UUID NOT NULL, -- References the ID in respective table

  -- Who is reporting
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Report details
  category report_category NOT NULL,
  description TEXT,

  -- Processing status
  status report_status DEFAULT 'pending',
  priority_score INTEGER DEFAULT 0, -- Calculated based on factors

  -- Review tracking
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  review_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate reports from same user
  CONSTRAINT unique_user_report UNIQUE(reporter_id, content_type, content_id)
);

-- Moderation actions taken
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What action was taken
  action_type moderation_action_type NOT NULL,

  -- On what content
  content_type reportable_content_type NOT NULL,
  content_id UUID NOT NULL,

  -- Who was affected
  affected_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Who took action
  moderator_id UUID NOT NULL REFERENCES public.profiles(id),

  -- Action details
  reason TEXT NOT NULL,
  internal_notes TEXT, -- Not shown to user

  -- Related reports (array of report IDs that led to this action)
  related_report_ids UUID[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- For temporary suspensions

  -- Reversal tracking
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES public.profiles(id),
  reversal_reason TEXT
);

-- User warnings (progressive discipline)
CREATE TABLE IF NOT EXISTS public.user_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  warning_level INTEGER NOT NULL CHECK (warning_level BETWEEN 1 AND 3),

  -- Related to what action
  action_id UUID REFERENCES public.moderation_actions(id),

  -- Warning details
  reason TEXT NOT NULL,
  message_sent TEXT, -- What was sent to user

  -- Acknowledgment
  acknowledged_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '90 days') -- Warnings expire
);

-- Appeals from users
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who is appealing
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- What action is being appealed
  action_id UUID NOT NULL REFERENCES public.moderation_actions(id),

  -- Appeal content
  statement TEXT NOT NULL,
  supporting_evidence TEXT,

  -- Processing
  status appeal_status DEFAULT 'pending',

  -- Review
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  decision_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One appeal per action
  CONSTRAINT one_appeal_per_action UNIQUE(user_id, action_id)
);

-- Reporter credibility tracking
CREATE TABLE IF NOT EXISTS public.reporter_credibility (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  total_reports INTEGER DEFAULT 0,
  accurate_reports INTEGER DEFAULT 0, -- Led to action
  false_reports INTEGER DEFAULT 0, -- Dismissed as false
  spam_reports INTEGER DEFAULT 0, -- Marked as spam/abuse of system

  credibility_score DECIMAL(3,2) DEFAULT 1.00, -- 0.00 to 1.00

  -- Rate limiting
  last_report_at TIMESTAMPTZ,
  reports_today INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Reports indexes
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.content_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_content ON public.content_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON public.content_reports(priority_score DESC, status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.content_reports(reporter_id);

-- Actions indexes
CREATE INDEX IF NOT EXISTS idx_actions_content ON public.moderation_actions(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_actions_user ON public.moderation_actions(affected_user_id);
CREATE INDEX IF NOT EXISTS idx_actions_active ON public.moderation_actions(created_at, reversed_at);

-- Warnings indexes
CREATE INDEX IF NOT EXISTS idx_warnings_user ON public.user_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_warnings_active ON public.user_warnings(user_id, expires_at);

-- Appeals indexes
CREATE INDEX IF NOT EXISTS idx_appeals_status ON public.moderation_appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_user ON public.moderation_appeals(user_id);

-- ============================================================================
-- Functions
-- ============================================================================

-- Calculate report priority score (simplified without database lookups in trigger)
CREATE OR REPLACE FUNCTION calculate_report_priority_simple(
  p_category report_category
) RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Base score by category severity
  RETURN CASE p_category
    WHEN 'scam_fraud' THEN 50
    WHEN 'harassment' THEN 45
    WHEN 'copyright_violation' THEN 40
    WHEN 'offensive_language' THEN 35
    WHEN 'inappropriate_content' THEN 30
    WHEN 'misleading_content' THEN 25
    WHEN 'spam' THEN 20
    ELSE 10
  END;
END;
$$;

-- Update reporter credibility after action
CREATE OR REPLACE FUNCTION update_reporter_credibility(
  p_report_id UUID,
  p_was_accurate BOOLEAN
) RETURNS VOID AS $$
DECLARE
  v_reporter_id UUID;
BEGIN
  -- Get reporter ID
  SELECT reporter_id INTO v_reporter_id FROM content_reports WHERE id = p_report_id;

  -- Insert or update credibility record
  INSERT INTO reporter_credibility (user_id, total_reports, accurate_reports, false_reports)
  VALUES (v_reporter_id, 1,
    CASE WHEN p_was_accurate THEN 1 ELSE 0 END,
    CASE WHEN NOT p_was_accurate THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_reports = reporter_credibility.total_reports + 1,
    accurate_reports = reporter_credibility.accurate_reports +
      CASE WHEN p_was_accurate THEN 1 ELSE 0 END,
    false_reports = reporter_credibility.false_reports +
      CASE WHEN NOT p_was_accurate THEN 1 ELSE 0 END,
    credibility_score = CASE
      WHEN (reporter_credibility.total_reports + 1) > 0 THEN
        LEAST(1.0, GREATEST(0.0,
          (reporter_credibility.accurate_reports + CASE WHEN p_was_accurate THEN 1 ELSE 0 END)::DECIMAL /
          (reporter_credibility.total_reports + 1)::DECIMAL
        ))
      ELSE 1.0
    END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-calculate priority on report insert (simplified)
CREATE OR REPLACE FUNCTION trigger_calculate_report_priority()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority_score := calculate_report_priority_simple(NEW.category);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'calculate_priority_on_insert') THEN
    CREATE TRIGGER calculate_priority_on_insert
      BEFORE INSERT ON public.content_reports
      FOR EACH ROW
      EXECUTE FUNCTION trigger_calculate_report_priority();
  END IF;
END $$;

-- Update timestamps
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_content_reports_updated_at') THEN
    CREATE TRIGGER update_content_reports_updated_at
      BEFORE UPDATE ON public.content_reports
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_moderation_appeals_updated_at') THEN
    CREATE TRIGGER update_moderation_appeals_updated_at
      BEFORE UPDATE ON public.moderation_appeals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_reporter_credibility_updated_at') THEN
    CREATE TRIGGER update_reporter_credibility_updated_at
      BEFORE UPDATE ON public.reporter_credibility
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporter_credibility ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create reports" ON public.content_reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.content_reports;
DROP POLICY IF EXISTS "Admins can manage all reports" ON public.content_reports;

DROP POLICY IF EXISTS "Users can view actions affecting them" ON public.moderation_actions;
DROP POLICY IF EXISTS "Admins can manage all actions" ON public.moderation_actions;

DROP POLICY IF EXISTS "Users can view own warnings" ON public.user_warnings;
DROP POLICY IF EXISTS "Admins can manage all warnings" ON public.user_warnings;

DROP POLICY IF EXISTS "Users can create own appeals" ON public.moderation_appeals;
DROP POLICY IF EXISTS "Users can view own appeals" ON public.moderation_appeals;
DROP POLICY IF EXISTS "Admins can manage all appeals" ON public.moderation_appeals;

DROP POLICY IF EXISTS "Users can view own credibility" ON public.reporter_credibility;
DROP POLICY IF EXISTS "Admins can manage credibility" ON public.reporter_credibility;

-- Content Reports Policies
CREATE POLICY "Users can create reports" ON public.content_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON public.content_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can manage all reports" ON public.content_reports
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- Moderation Actions Policies
CREATE POLICY "Users can view actions affecting them" ON public.moderation_actions
  FOR SELECT TO authenticated
  USING (auth.uid() = affected_user_id);

CREATE POLICY "Admins can manage all actions" ON public.moderation_actions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- User Warnings Policies
CREATE POLICY "Users can view own warnings" ON public.user_warnings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all warnings" ON public.user_warnings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- Appeals Policies
CREATE POLICY "Users can create own appeals" ON public.moderation_appeals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own appeals" ON public.moderation_appeals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all appeals" ON public.moderation_appeals
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- Reporter Credibility Policies
CREATE POLICY "Users can view own credibility" ON public.reporter_credibility
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage credibility" ON public.reporter_credibility
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role_flags->>'is_admin')::boolean = true
    )
  );