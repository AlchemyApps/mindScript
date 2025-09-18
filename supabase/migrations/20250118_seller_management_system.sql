-- ============================================================================
-- Seller Management System
-- ============================================================================
-- Purpose: Admin tools for managing marketplace sellers, KYC, and payouts

-- ============================================================================
-- Enums
-- ============================================================================

-- KYC verification status
DO $$ BEGIN
  CREATE TYPE kyc_status AS ENUM (
    'not_started',
    'pending',
    'under_review',
    'approved',
    'rejected',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Seller account status
DO $$ BEGIN
  CREATE TYPE seller_status AS ENUM (
    'pending_kyc',
    'active',
    'suspended',
    'banned',
    'inactive'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Payout status
DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM (
    'scheduled',
    'processing',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- Tables
-- ============================================================================

-- Seller profiles with business information
CREATE TABLE IF NOT EXISTS public.seller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Business info
  business_name TEXT,
  business_type TEXT, -- individual, company, non_profit
  tax_id TEXT,

  -- Contact
  business_email TEXT,
  business_phone TEXT,
  business_address JSONB,

  -- Stripe Connect
  stripe_account_id TEXT UNIQUE,
  stripe_onboarding_complete BOOLEAN DEFAULT false,

  -- Status
  status seller_status DEFAULT 'pending_kyc',
  kyc_status kyc_status DEFAULT 'not_started',

  -- Commission & Payouts
  commission_rate DECIMAL(5,2) DEFAULT 15.00, -- Platform commission %
  payout_schedule TEXT DEFAULT 'weekly', -- daily, weekly, monthly, manual
  minimum_payout DECIMAL(10,2) DEFAULT 10.00,

  -- Metrics
  total_sales INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0.00,
  total_payouts DECIMAL(10,2) DEFAULT 0.00,
  average_rating DECIMAL(3,2),

  -- Risk indicators
  chargeback_count INTEGER DEFAULT 0,
  dispute_count INTEGER DEFAULT 0,
  risk_score INTEGER DEFAULT 0, -- 0-100

  -- Metadata
  verified_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  notes TEXT, -- Internal admin notes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_user_seller UNIQUE(user_id)
);

-- KYC documents and verification
CREATE TABLE IF NOT EXISTS public.seller_kyc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,

  -- Document info
  document_type TEXT NOT NULL, -- id_front, id_back, proof_of_address, business_license
  document_url TEXT NOT NULL, -- Stored in Supabase Storage

  -- Verification
  status kyc_status DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,

  -- Expiry
  expires_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payout records
CREATE TABLE IF NOT EXISTS public.seller_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,

  -- Payout details
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status payout_status DEFAULT 'scheduled',

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Stripe
  stripe_payout_id TEXT,
  stripe_transfer_id TEXT,

  -- Processing
  scheduled_for TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Failure handling
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Admin actions audit log
CREATE TABLE IF NOT EXISTS public.seller_admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id),

  action_type TEXT NOT NULL, -- suspend, reinstate, approve_kyc, reject_kyc, adjust_commission, manual_payout
  action_details JSONB,
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seller performance metrics (for dashboard)
CREATE TABLE IF NOT EXISTS public.seller_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,

  -- Time period
  period_date DATE NOT NULL,

  -- Metrics
  sales_count INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0.00,
  refunds_count INTEGER DEFAULT 0,
  refunds_amount DECIMAL(10,2) DEFAULT 0.00,

  -- Quality
  average_rating DECIMAL(3,2),
  review_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_seller_period UNIQUE(seller_id, period_date)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_seller_profiles_status ON public.seller_profiles(status);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_kyc_status ON public.seller_profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_user_id ON public.seller_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_stripe_account ON public.seller_profiles(stripe_account_id);

CREATE INDEX IF NOT EXISTS idx_seller_kyc_seller ON public.seller_kyc(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_kyc_status ON public.seller_kyc(status);

CREATE INDEX IF NOT EXISTS idx_seller_payouts_seller ON public.seller_payouts(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_status ON public.seller_payouts(status);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_scheduled ON public.seller_payouts(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_seller_admin_actions_seller ON public.seller_admin_actions(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_admin_actions_admin ON public.seller_admin_actions(admin_id);

CREATE INDEX IF NOT EXISTS idx_seller_metrics_seller ON public.seller_metrics(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_metrics_period ON public.seller_metrics(period_date);

-- ============================================================================
-- Functions
-- ============================================================================

-- Calculate seller risk score
CREATE OR REPLACE FUNCTION calculate_seller_risk_score(
  p_seller_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_risk_score INTEGER := 0;
  v_seller seller_profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_seller FROM seller_profiles WHERE id = p_seller_id;

  -- Base risk from chargebacks/disputes
  v_risk_score := v_risk_score + (v_seller.chargeback_count * 20);
  v_risk_score := v_risk_score + (v_seller.dispute_count * 10);

  -- Risk from low rating
  IF v_seller.average_rating IS NOT NULL AND v_seller.average_rating < 3.0 THEN
    v_risk_score := v_risk_score + 15;
  END IF;

  -- Risk from new seller
  IF v_seller.created_at > (now() - INTERVAL '30 days') THEN
    v_risk_score := v_risk_score + 10;
  END IF;

  -- Cap at 100
  v_risk_score := LEAST(v_risk_score, 100);

  RETURN v_risk_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update timestamps
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_seller_profiles_updated_at') THEN
    CREATE TRIGGER update_seller_profiles_updated_at
      BEFORE UPDATE ON public.seller_profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_seller_kyc_updated_at') THEN
    CREATE TRIGGER update_seller_kyc_updated_at
      BEFORE UPDATE ON public.seller_kyc
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_seller_payouts_updated_at') THEN
    CREATE TRIGGER update_seller_payouts_updated_at
      BEFORE UPDATE ON public.seller_payouts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_metrics ENABLE ROW LEVEL SECURITY;

-- Seller Profiles Policies
CREATE POLICY "Sellers can view own profile" ON public.seller_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all seller profiles" ON public.seller_profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- KYC Policies
CREATE POLICY "Sellers can view own KYC" ON public.seller_kyc
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_profiles
      WHERE id = seller_kyc.seller_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all KYC" ON public.seller_kyc
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- Payouts Policies
CREATE POLICY "Sellers can view own payouts" ON public.seller_payouts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_profiles
      WHERE id = seller_payouts.seller_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all payouts" ON public.seller_payouts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- Admin Actions Policies (admins only)
CREATE POLICY "Admins can manage admin actions" ON public.seller_admin_actions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role_flags->>'is_admin')::boolean = true
    )
  );

-- Metrics Policies
CREATE POLICY "Sellers can view own metrics" ON public.seller_metrics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_profiles
      WHERE id = seller_metrics.seller_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all metrics" ON public.seller_metrics
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role_flags->>'is_admin')::boolean = true
    )
  );