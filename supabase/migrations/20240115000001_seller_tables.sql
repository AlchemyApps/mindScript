-- Create purchases table if not exists (needed for foreign keys)
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  track_id UUID REFERENCES public.tracks(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  
  -- Payment details
  sale_price_cents INTEGER NOT NULL CHECK (sale_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (LENGTH(currency) = 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled')),
  
  -- Platform-specific
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  iap_product_id TEXT,
  iap_receipt_data TEXT,
  revenuecat_transaction_id TEXT,
  
  -- Revenue split
  seller_share_cents INTEGER CHECK (seller_share_cents >= 0),
  platform_fee_cents INTEGER CHECK (platform_fee_cents >= 0),
  processor_fee_cents INTEGER CHECK (processor_fee_cents >= 0),
  
  -- Metadata
  is_first_purchase BOOLEAN DEFAULT FALSE,
  refunded_at TIMESTAMPTZ,
  refund_amount INTEGER CHECK (refund_amount >= 0),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create seller_agreements table
CREATE TABLE IF NOT EXISTS public.seller_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_connect_account_id TEXT UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'express' CHECK (account_type IN ('express', 'standard', 'custom')),
  status TEXT NOT NULL DEFAULT 'pending_onboarding' CHECK (status IN ('pending_onboarding', 'onboarding_incomplete', 'active', 'suspended', 'rejected')),
  
  -- Onboarding details
  onboarding_completed_at TIMESTAMPTZ,
  details_submitted BOOLEAN DEFAULT FALSE,
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  
  -- Platform configuration
  platform_fee_percent NUMERIC(5,2) DEFAULT 15.00 CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100),
  custom_pricing_enabled BOOLEAN DEFAULT FALSE,
  
  -- Compliance
  tos_accepted_at TIMESTAMPTZ,
  tos_accepted_ip INET,
  kyc_verified_at TIMESTAMPTZ,
  
  -- Metadata
  default_currency TEXT DEFAULT 'USD' CHECK (LENGTH(default_currency) = 3),
  country TEXT CHECK (LENGTH(country) = 2 OR country IS NULL),
  business_name TEXT,
  business_type TEXT CHECK (business_type IN ('individual', 'company') OR business_type IS NULL),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_seller UNIQUE (user_id),
  CONSTRAINT valid_onboarding_status CHECK (
    (status = 'active' AND charges_enabled = TRUE AND payouts_enabled = TRUE) OR
    status != 'active'
  )
);

-- Create earnings_ledger table
CREATE TABLE IF NOT EXISTS public.earnings_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE RESTRICT,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE RESTRICT,
  
  -- Financial breakdown (all amounts in cents)
  gross_cents INTEGER NOT NULL CHECK (gross_cents >= 0),
  processor_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (processor_fee_cents >= 0),
  platform_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0),
  seller_earnings_cents INTEGER NOT NULL CHECK (seller_earnings_cents >= 0),
  
  -- Payout tracking
  payout_id UUID REFERENCES public.payouts(id) ON DELETE SET NULL,
  payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
  payout_date TIMESTAMPTZ,
  
  -- Metadata
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (LENGTH(currency) = 3),
  channel TEXT NOT NULL CHECK (channel IN ('web', 'ios', 'android')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_earnings CHECK (seller_earnings_cents = gross_cents - processor_fee_cents - platform_fee_cents),
  CONSTRAINT unique_purchase_ledger UNIQUE (purchase_id)
);

-- Create payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  stripe_transfer_id TEXT UNIQUE,
  
  -- Financial details (amounts in cents)
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (LENGTH(currency) = 3),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  failure_reason TEXT,
  
  -- Period information
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0 CHECK (transaction_count >= 0),
  
  -- Processing details
  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_period CHECK (period_end > period_start),
  CONSTRAINT valid_completion CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed' AND completed_at IS NULL)
  )
);

-- Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('stripe', 'revenuecat', 'resend')),
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Idempotency
  idempotency_key TEXT GENERATED ALWAYS AS (source || ':' || event_id) STORED UNIQUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seller_agreements_user_id ON public.seller_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_agreements_status ON public.seller_agreements(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_seller_agreements_stripe_account ON public.seller_agreements(stripe_connect_account_id) WHERE stripe_connect_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_earnings_ledger_seller_id ON public.earnings_ledger(seller_id);
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_payout_id ON public.earnings_ledger(payout_id) WHERE payout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_payout_status ON public.earnings_ledger(payout_status) WHERE payout_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_earnings_ledger_created_at ON public.earnings_ledger(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payouts_seller_id ON public.payouts(seller_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_period ON public.payouts(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON public.payouts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source_type ON public.webhook_events(source, event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- RLS Policies
ALTER TABLE public.seller_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Seller agreements policies
CREATE POLICY "Users can view their own seller agreement"
  ON public.seller_agreements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own seller agreement"
  ON public.seller_agreements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own seller agreement"
  ON public.seller_agreements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Earnings ledger policies
CREATE POLICY "Sellers can view their own earnings"
  ON public.earnings_ledger FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Service role can manage earnings"
  ON public.earnings_ledger FOR ALL
  USING (auth.role() = 'service_role');

-- Payouts policies
CREATE POLICY "Sellers can view their own payouts"
  ON public.payouts FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Service role can manage payouts"
  ON public.payouts FOR ALL
  USING (auth.role() = 'service_role');

-- Webhook events policies (service role only)
CREATE POLICY "Service role can manage webhook events"
  ON public.webhook_events FOR ALL
  USING (auth.role() = 'service_role');

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_seller_agreements_updated_at
  BEFORE UPDATE ON public.seller_agreements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_earnings_ledger_updated_at
  BEFORE UPDATE ON public.earnings_ledger
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to calculate seller earnings summary
CREATE OR REPLACE FUNCTION get_seller_earnings_summary(p_seller_id UUID)
RETURNS TABLE (
  total_earnings_cents BIGINT,
  pending_payout_cents BIGINT,
  completed_payouts_cents BIGINT,
  available_balance_cents BIGINT,
  platform_fees_cents BIGINT,
  processing_fees_cents BIGINT,
  last_payout_date TIMESTAMPTZ,
  next_payout_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH earnings AS (
    SELECT 
      COALESCE(SUM(seller_earnings_cents), 0) AS total_earnings,
      COALESCE(SUM(CASE WHEN payout_status = 'pending' THEN seller_earnings_cents ELSE 0 END), 0) AS pending,
      COALESCE(SUM(platform_fee_cents), 0) AS platform_fees,
      COALESCE(SUM(processor_fee_cents), 0) AS processing_fees
    FROM public.earnings_ledger
    WHERE seller_id = p_seller_id
  ),
  payouts_summary AS (
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_cents ELSE 0 END), 0) AS completed,
      MAX(CASE WHEN status = 'completed' THEN completed_at END) AS last_payout
    FROM public.payouts
    WHERE seller_id = p_seller_id
  )
  SELECT 
    earnings.total_earnings::BIGINT,
    earnings.pending::BIGINT,
    payouts_summary.completed::BIGINT,
    (earnings.pending)::BIGINT AS available_balance_cents,
    earnings.platform_fees::BIGINT,
    earnings.processing_fees::BIGINT,
    payouts_summary.last_payout,
    -- Next payout is Monday of next week if balance > $10
    CASE 
      WHEN earnings.pending >= 1000 THEN 
        date_trunc('week', CURRENT_DATE + INTERVAL '1 week')::DATE + INTERVAL '0 days'
      ELSE NULL
    END AS next_payout_date
  FROM earnings, payouts_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_seller_earnings_summary(UUID) TO authenticated;