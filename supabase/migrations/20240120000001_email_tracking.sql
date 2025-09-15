-- ============================================================================
-- Email Tracking and Preferences Tables
-- ============================================================================
-- This migration adds support for email tracking and user preferences
-- to handle Resend webhook events and manage email deliverability
-- ============================================================================

-- ============================================================================
-- Email Logs Table
-- ============================================================================
-- Tracks all emails sent through the system with delivery status
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Email identifiers
  resend_email_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Email metadata
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL CHECK (email_type IN (
    'transactional',
    'marketing',
    'system',
    'purchase_confirmation',
    'render_complete',
    'welcome',
    'password_reset',
    'payout_notification'
  )),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'delivered',
    'delivery_delayed',
    'bounced',
    'complained',
    'failed'
  )),

  -- Event timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,

  -- Metrics
  open_count INTEGER DEFAULT 0 CHECK (open_count >= 0),
  click_count INTEGER DEFAULT 0 CHECK (click_count >= 0),

  -- Error tracking
  bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft', 'block', NULL)),
  bounce_reason TEXT,
  delay_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  tags TEXT[] DEFAULT '{}',
  campaign_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON public.email_logs(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON public.email_logs(to_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON public.email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON public.email_logs(campaign_id) WHERE campaign_id IS NOT NULL;

-- RLS Policies
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email logs"
  ON public.email_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all email logs"
  ON public.email_logs FOR ALL
  USING (public.auth_has_role('service_role'));

CREATE POLICY "Admin users can view all email logs"
  ON public.email_logs FOR SELECT
  USING (public.auth_has_role('admin'));

-- ============================================================================
-- User Email Preferences Table
-- ============================================================================
-- Manages user email preferences and suppression list
CREATE TABLE IF NOT EXISTS public.user_email_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,

  -- Subscription preferences
  marketing_emails BOOLEAN DEFAULT TRUE,
  transactional_emails BOOLEAN DEFAULT TRUE,
  weekly_digest BOOLEAN DEFAULT TRUE,
  product_updates BOOLEAN DEFAULT TRUE,

  -- Suppression status
  is_suppressed BOOLEAN DEFAULT FALSE,
  suppression_reason TEXT CHECK (suppression_reason IN (
    'user_unsubscribed',
    'hard_bounce',
    'spam_complaint',
    'admin_suppressed',
    NULL
  )),
  suppressed_at TIMESTAMPTZ,

  -- Bounce tracking
  bounce_count INTEGER DEFAULT 0 CHECK (bounce_count >= 0),
  last_bounce_at TIMESTAMPTZ,
  last_bounce_type TEXT,

  -- Complaint tracking
  complaint_count INTEGER DEFAULT 0 CHECK (complaint_count >= 0),
  last_complaint_at TIMESTAMPTZ,

  -- Engagement metrics
  last_email_sent_at TIMESTAMPTZ,
  last_email_opened_at TIMESTAMPTZ,
  last_email_clicked_at TIMESTAMPTZ,
  total_emails_sent INTEGER DEFAULT 0 CHECK (total_emails_sent >= 0),
  total_emails_opened INTEGER DEFAULT 0 CHECK (total_emails_opened >= 0),
  total_emails_clicked INTEGER DEFAULT 0 CHECK (total_emails_clicked >= 0),

  -- Metadata
  unsubscribe_token UUID DEFAULT uuid_generate_v4(),
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, email)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id ON public.user_email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_preferences_email ON public.user_email_preferences(email);
CREATE INDEX IF NOT EXISTS idx_email_preferences_suppressed ON public.user_email_preferences(is_suppressed) WHERE is_suppressed = TRUE;
CREATE INDEX IF NOT EXISTS idx_email_preferences_unsubscribe_token ON public.user_email_preferences(unsubscribe_token);

-- RLS Policies
ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email preferences"
  ON public.user_email_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own email preferences"
  ON public.user_email_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all email preferences"
  ON public.user_email_preferences FOR ALL
  USING (public.auth_has_role('service_role'));

-- ============================================================================
-- Email Campaign Metrics View
-- ============================================================================
-- Aggregated view for email campaign analytics
CREATE OR REPLACE VIEW public.email_campaign_metrics AS
SELECT
  campaign_id,
  email_type,
  COUNT(*) as total_sent,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
  COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
  COUNT(CASE WHEN status = 'complained' THEN 1 END) as complained,
  COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
  COUNT(CASE WHEN last_clicked_at IS NOT NULL THEN 1 END) as clicked,
  ROUND(100.0 * COUNT(CASE WHEN status = 'delivered' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as delivery_rate,
  ROUND(100.0 * COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) / NULLIF(COUNT(CASE WHEN status = 'delivered' THEN 1 END), 0), 2) as open_rate,
  ROUND(100.0 * COUNT(CASE WHEN last_clicked_at IS NOT NULL THEN 1 END) / NULLIF(COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END), 0), 2) as click_rate,
  MIN(created_at) as campaign_started,
  MAX(created_at) as campaign_ended
FROM public.email_logs
WHERE campaign_id IS NOT NULL
GROUP BY campaign_id, email_type;

-- Grant access to the view
GRANT SELECT ON public.email_campaign_metrics TO authenticated;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to check if an email should be sent to a user
CREATE OR REPLACE FUNCTION public.can_send_email(
  p_user_id UUID,
  p_email TEXT,
  p_email_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_preferences RECORD;
BEGIN
  -- Get user preferences
  SELECT * INTO v_preferences
  FROM public.user_email_preferences
  WHERE user_id = p_user_id AND email = p_email;

  -- If no preferences exist, allow sending
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  -- Check if user is suppressed
  IF v_preferences.is_suppressed THEN
    RETURN FALSE;
  END IF;

  -- Check specific email type preferences
  CASE p_email_type
    WHEN 'marketing' THEN
      RETURN v_preferences.marketing_emails;
    WHEN 'transactional', 'purchase_confirmation', 'render_complete', 'password_reset' THEN
      RETURN v_preferences.transactional_emails;
    WHEN 'weekly_digest' THEN
      RETURN v_preferences.weekly_digest;
    WHEN 'product_updates' THEN
      RETURN v_preferences.product_updates;
    ELSE
      -- Allow system emails by default
      RETURN TRUE;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update email metrics after a webhook event
CREATE OR REPLACE FUNCTION public.update_email_metrics(
  p_email TEXT,
  p_event_type TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_email_preferences
  SET
    total_emails_opened = CASE
      WHEN p_event_type = 'email.opened' THEN total_emails_opened + 1
      ELSE total_emails_opened
    END,
    total_emails_clicked = CASE
      WHEN p_event_type = 'email.clicked' THEN total_emails_clicked + 1
      ELSE total_emails_clicked
    END,
    last_email_opened_at = CASE
      WHEN p_event_type = 'email.opened' THEN NOW()
      ELSE last_email_opened_at
    END,
    last_email_clicked_at = CASE
      WHEN p_event_type = 'email.clicked' THEN NOW()
      ELSE last_email_clicked_at
    END,
    updated_at = NOW()
  WHERE email = p_email;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_logs_updated_at();

CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON public.user_email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_logs_updated_at();

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE public.email_logs IS 'Tracks all emails sent through the system with delivery status from Resend webhooks';
COMMENT ON TABLE public.user_email_preferences IS 'Manages user email preferences and suppression list for deliverability';
COMMENT ON VIEW public.email_campaign_metrics IS 'Aggregated metrics for email campaign performance';
COMMENT ON FUNCTION public.can_send_email IS 'Checks if an email should be sent based on user preferences and suppression status';
COMMENT ON FUNCTION public.update_email_metrics IS 'Updates email engagement metrics based on webhook events';