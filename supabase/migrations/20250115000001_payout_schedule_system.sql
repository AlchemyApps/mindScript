-- Create payout_schedule table for managing scheduled payouts
CREATE TABLE IF NOT EXISTS public.payout_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name TEXT NOT NULL UNIQUE,

  -- Schedule configuration
  is_active BOOLEAN DEFAULT TRUE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('weekly', 'biweekly', 'monthly', 'manual')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Monday, 6 = Sunday
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
  hour_utc INTEGER NOT NULL DEFAULT 0 CHECK (hour_utc >= 0 AND hour_utc <= 23),

  -- Payout configuration
  minimum_payout_cents INTEGER NOT NULL DEFAULT 1000 CHECK (minimum_payout_cents >= 0),
  platform_fee_percent NUMERIC(5,2) DEFAULT 15.00 CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100),
  hold_period_days INTEGER DEFAULT 7 CHECK (hold_period_days >= 0),

  -- Last run tracking
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'partial', 'failed')),
  last_run_summary JSONB,
  next_run_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_weekly_schedule CHECK (
    (schedule_type = 'weekly' AND day_of_week IS NOT NULL AND day_of_month IS NULL) OR
    schedule_type != 'weekly'
  ),
  CONSTRAINT valid_monthly_schedule CHECK (
    (schedule_type = 'monthly' AND day_of_month IS NOT NULL AND day_of_week IS NULL) OR
    schedule_type != 'monthly'
  )
);

-- Create payout_history table for audit trail
CREATE TABLE IF NOT EXISTS public.payout_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID REFERENCES public.payouts(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.payout_schedule(id) ON DELETE SET NULL,

  -- Action tracking
  action TEXT NOT NULL CHECK (action IN ('created', 'processing', 'completed', 'failed', 'retried', 'reconciled', 'manual_override')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'user', 'admin')),

  -- Details
  details JSONB,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create payout_notifications table
CREATE TABLE IF NOT EXISTS public.payout_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID REFERENCES public.payouts(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification details
  notification_type TEXT NOT NULL CHECK (notification_type IN ('payout_initiated', 'payout_completed', 'payout_failed', 'reconciliation_issue')),
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'push')),
  recipient TEXT NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  -- Email specific
  email_id TEXT, -- Resend email ID

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create payout_reconciliation table
CREATE TABLE IF NOT EXISTS public.payout_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID REFERENCES public.payouts(id) ON DELETE CASCADE,

  -- Reconciliation details
  expected_amount_cents INTEGER NOT NULL,
  actual_amount_cents INTEGER NOT NULL,
  difference_cents INTEGER GENERATED ALWAYS AS (expected_amount_cents - actual_amount_cents) STORED,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'discrepancy', 'resolved')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create manual_payout_override table
CREATE TABLE IF NOT EXISTS public.manual_payout_override (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Override details
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (LENGTH(currency) = 3),
  reason TEXT NOT NULL,

  -- Authorization
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ,

  -- Processing
  payout_id UUID REFERENCES public.payouts(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed', 'cancelled')),
  rejection_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_approval CHECK (
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
    status != 'approved'
  ),
  CONSTRAINT valid_processing CHECK (
    (status = 'processed' AND payout_id IS NOT NULL AND processed_at IS NOT NULL) OR
    status != 'processed'
  )
);

-- Add missing columns to payouts table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'payouts'
    AND column_name = 'schedule_id'
  ) THEN
    ALTER TABLE public.payouts
    ADD COLUMN schedule_id UUID REFERENCES public.payout_schedule(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'payouts'
    AND column_name = 'reconciled_at'
  ) THEN
    ALTER TABLE public.payouts
    ADD COLUMN reconciled_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payout_schedule_active ON public.payout_schedule(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_payout_schedule_next_run ON public.payout_schedule(next_run_at) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_payout_history_payout_id ON public.payout_history(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_history_schedule_id ON public.payout_history(schedule_id);
CREATE INDEX IF NOT EXISTS idx_payout_history_created_at ON public.payout_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_notifications_payout_id ON public.payout_notifications(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_notifications_seller_id ON public.payout_notifications(seller_id);
CREATE INDEX IF NOT EXISTS idx_payout_notifications_status ON public.payout_notifications(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_payout_reconciliation_payout_id ON public.payout_reconciliation(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_reconciliation_status ON public.payout_reconciliation(status);

CREATE INDEX IF NOT EXISTS idx_manual_payout_override_seller_id ON public.manual_payout_override(seller_id);
CREATE INDEX IF NOT EXISTS idx_manual_payout_override_status ON public.manual_payout_override(status);

-- Enable RLS
ALTER TABLE public.payout_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_payout_override ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Payout schedule (admin only)
CREATE POLICY "Admins can manage payout schedules"
  ON public.payout_schedule FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Payout history (read for sellers, write for service)
CREATE POLICY "Sellers can view their payout history"
  ON public.payout_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.payouts p
      WHERE p.id = payout_history.payout_id
      AND p.seller_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage payout history"
  ON public.payout_history FOR ALL
  USING (auth.role() = 'service_role');

-- Payout notifications (sellers view own, service manages)
CREATE POLICY "Sellers can view their notifications"
  ON public.payout_notifications FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "Service role can manage notifications"
  ON public.payout_notifications FOR ALL
  USING (auth.role() = 'service_role');

-- Reconciliation (admin only)
CREATE POLICY "Admins can manage reconciliation"
  ON public.payout_reconciliation FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Manual overrides (admin only)
CREATE POLICY "Admins can manage manual overrides"
  ON public.manual_payout_override FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Create triggers for updated_at
CREATE TRIGGER update_payout_schedule_updated_at
  BEFORE UPDATE ON public.payout_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payout_notifications_updated_at
  BEFORE UPDATE ON public.payout_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payout_reconciliation_updated_at
  BEFORE UPDATE ON public.payout_reconciliation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_manual_payout_override_updated_at
  BEFORE UPDATE ON public.manual_payout_override
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to calculate next payout run
CREATE OR REPLACE FUNCTION calculate_next_payout_run(
  p_schedule_type TEXT,
  p_day_of_week INTEGER,
  p_day_of_month INTEGER,
  p_hour_utc INTEGER,
  p_last_run TIMESTAMPTZ DEFAULT NULL
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_next_run TIMESTAMPTZ;
  v_base_date DATE;
BEGIN
  -- Use current date or last run date as base
  v_base_date := COALESCE(p_last_run::DATE, CURRENT_DATE);

  CASE p_schedule_type
    WHEN 'weekly' THEN
      -- Find next occurrence of the specified weekday
      v_next_run := v_base_date + ((p_day_of_week - EXTRACT(DOW FROM v_base_date)::INTEGER + 7) % 7) * INTERVAL '1 day';
      IF v_next_run <= COALESCE(p_last_run, NOW()) THEN
        v_next_run := v_next_run + INTERVAL '7 days';
      END IF;

    WHEN 'biweekly' THEN
      -- Similar to weekly but add 14 days
      v_next_run := v_base_date + ((p_day_of_week - EXTRACT(DOW FROM v_base_date)::INTEGER + 7) % 7) * INTERVAL '1 day';
      IF v_next_run <= COALESCE(p_last_run, NOW()) THEN
        v_next_run := v_next_run + INTERVAL '14 days';
      END IF;

    WHEN 'monthly' THEN
      -- Find next occurrence of the specified day of month
      v_next_run := DATE_TRUNC('month', v_base_date) + (p_day_of_month - 1) * INTERVAL '1 day';
      IF v_next_run <= COALESCE(p_last_run, NOW()) THEN
        v_next_run := DATE_TRUNC('month', v_base_date + INTERVAL '1 month') + (p_day_of_month - 1) * INTERVAL '1 day';
      END IF;

    ELSE
      -- Manual or unknown type
      RETURN NULL;
  END CASE;

  -- Add the hour component
  v_next_run := v_next_run + p_hour_utc * INTERVAL '1 hour';

  RETURN v_next_run;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default weekly payout schedule (Mondays at 00:00 UTC)
INSERT INTO public.payout_schedule (
  schedule_name,
  schedule_type,
  day_of_week,
  hour_utc,
  minimum_payout_cents,
  platform_fee_percent,
  hold_period_days,
  next_run_at
) VALUES (
  'Weekly Monday Payouts',
  'weekly',
  0, -- Monday
  0, -- Midnight UTC
  1000, -- $10 minimum
  15.00, -- 15% platform fee
  7, -- 7 day hold period
  calculate_next_payout_run('weekly', 0, NULL, 0)
) ON CONFLICT (schedule_name) DO NOTHING;

-- Create pg_cron job for scheduled payouts
SELECT cron.schedule(
  'process-scheduled-payouts',
  '0 * * * *', -- Every hour
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/scheduled-payouts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'action', 'check_schedules',
      'timestamp', NOW()
    )
  );
  $$
);

-- Add comments
COMMENT ON TABLE public.payout_schedule IS 'Manages scheduled payout configurations';
COMMENT ON TABLE public.payout_history IS 'Audit trail for all payout actions';
COMMENT ON TABLE public.payout_notifications IS 'Tracks notifications sent to sellers about payouts';
COMMENT ON TABLE public.payout_reconciliation IS 'Tracks reconciliation between payouts and ledger entries';
COMMENT ON TABLE public.manual_payout_override IS 'Allows admins to manually trigger payouts outside schedule';
COMMENT ON FUNCTION calculate_next_payout_run IS 'Calculates the next scheduled payout run time';