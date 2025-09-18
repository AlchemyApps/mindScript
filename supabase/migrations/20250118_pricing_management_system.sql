-- Pricing Management System
-- This migration creates tables for managing subscription tiers, features, and pricing configurations

-- Create pricing tiers table
CREATE TABLE IF NOT EXISTS public.pricing_tiers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    interval TEXT CHECK (interval IN ('one_time', 'monthly', 'yearly')) NOT NULL DEFAULT 'one_time',
    interval_count INTEGER DEFAULT 1,
    stripe_price_id TEXT,
    stripe_test_price_id TEXT,
    features JSONB NOT NULL DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    position INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create feature flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT CHECK (type IN ('boolean', 'number', 'string', 'json')) NOT NULL DEFAULT 'boolean',
    default_value JSONB NOT NULL DEFAULT 'false',
    tier_overrides JSONB DEFAULT '{}', -- Map of tier_id to value
    is_active BOOLEAN NOT NULL DEFAULT true,
    rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create pricing configurations table
CREATE TABLE IF NOT EXISTS public.pricing_configurations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create tier features junction table
CREATE TABLE IF NOT EXISTS public.tier_features (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tier_id UUID NOT NULL REFERENCES public.pricing_tiers(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tier_id, feature_id)
);

-- Create user subscriptions table (if not exists)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES public.pricing_tiers(id),
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    status TEXT CHECK (status IN ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused')) NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create pricing audit log
CREATE TABLE IF NOT EXISTS public.pricing_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    performed_by UUID REFERENCES auth.users(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_pricing_tiers_active ON public.pricing_tiers(is_active) WHERE is_active = true;
CREATE INDEX idx_pricing_tiers_position ON public.pricing_tiers(position);
CREATE INDEX idx_feature_flags_active ON public.feature_flags(is_active) WHERE is_active = true;
CREATE INDEX idx_pricing_configurations_key ON public.pricing_configurations(key);
CREATE INDEX idx_pricing_configurations_category ON public.pricing_configurations(category);
CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX idx_pricing_audit_log_entity ON public.pricing_audit_log(entity_type, entity_id);
CREATE INDEX idx_pricing_audit_log_created ON public.pricing_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pricing_tiers
-- Public can read active tiers
CREATE POLICY "Public can read active pricing tiers"
    ON public.pricing_tiers FOR SELECT
    USING (is_active = true);

-- Admins can manage all tiers
CREATE POLICY "Admins can manage pricing tiers"
    ON public.pricing_tiers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- RLS Policies for feature_flags
-- Public can read active feature flags
CREATE POLICY "Public can read active feature flags"
    ON public.feature_flags FOR SELECT
    USING (is_active = true);

-- Admins can manage all feature flags
CREATE POLICY "Admins can manage feature flags"
    ON public.feature_flags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- RLS Policies for pricing_configurations
-- Service role and admins can read configurations
CREATE POLICY "Admins can read pricing configurations"
    ON public.pricing_configurations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Only admins can manage configurations
CREATE POLICY "Admins can manage pricing configurations"
    ON public.pricing_configurations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- RLS Policies for tier_features
-- Public can read tier features
CREATE POLICY "Public can read tier features"
    ON public.tier_features FOR SELECT
    USING (true);

-- Admins can manage tier features
CREATE POLICY "Admins can manage tier features"
    ON public.tier_features FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- RLS Policies for user_subscriptions
-- Users can read their own subscriptions
CREATE POLICY "Users can read own subscriptions"
    ON public.user_subscriptions FOR SELECT
    USING (user_id = auth.uid());

-- Service role and admins can manage subscriptions
CREATE POLICY "Admins can manage subscriptions"
    ON public.user_subscriptions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- RLS Policies for pricing_audit_log
-- Only admins can read audit logs
CREATE POLICY "Admins can read audit logs"
    ON public.pricing_audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Only system can write audit logs (via service role)
CREATE POLICY "System can write audit logs"
    ON public.pricing_audit_log FOR INSERT
    WITH CHECK (true);

-- Functions
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_pricing_tiers_updated_at
    BEFORE UPDATE ON public.pricing_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pricing_updated_at();

CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON public.feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pricing_updated_at();

CREATE TRIGGER update_pricing_configurations_updated_at
    BEFORE UPDATE ON public.pricing_configurations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pricing_updated_at();

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pricing_updated_at();

-- Function to log pricing changes
CREATE OR REPLACE FUNCTION public.log_pricing_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.pricing_audit_log (
            action,
            entity_type,
            entity_id,
            new_value,
            performed_by
        ) VALUES (
            'create',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(NEW),
            auth.uid()
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.pricing_audit_log (
            action,
            entity_type,
            entity_id,
            old_value,
            new_value,
            performed_by
        ) VALUES (
            'update',
            TG_TABLE_NAME,
            NEW.id,
            to_jsonb(OLD),
            to_jsonb(NEW),
            auth.uid()
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.pricing_audit_log (
            action,
            entity_type,
            entity_id,
            old_value,
            performed_by
        ) VALUES (
            'delete',
            TG_TABLE_NAME,
            OLD.id,
            to_jsonb(OLD),
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for important tables
CREATE TRIGGER log_pricing_tiers_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.pricing_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.log_pricing_change();

CREATE TRIGGER log_feature_flags_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION public.log_pricing_change();

CREATE TRIGGER log_pricing_configurations_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.pricing_configurations
    FOR EACH ROW
    EXECUTE FUNCTION public.log_pricing_change();

-- Insert default pricing configurations
INSERT INTO public.pricing_configurations (key, value, description, category) VALUES
    ('base_intro_web_cents', '100', 'Introductory web price in cents ($1)', 'pricing'),
    ('base_standard_web_cents', '300', 'Standard web price in cents ($3)', 'pricing'),
    ('elevenlabs_setup_fee_cents', '50', 'ElevenLabs voice setup fee in cents', 'pricing'),
    ('solfeggio_cents', '100', 'Solfeggio frequency add-on price in cents', 'pricing'),
    ('binaural_cents', '100', 'Binaural beats add-on price in cents', 'pricing'),
    ('seller_share_web', '70', 'Seller revenue share percentage for web', 'revenue_share'),
    ('seller_share_native', '60', 'Seller revenue share percentage for native (after store fees)', 'revenue_share'),
    ('platform_fee_percentage', '30', 'Platform fee percentage', 'revenue_share'),
    ('stripe_fee_fixed_cents', '30', 'Stripe fixed fee in cents', 'payment_processing'),
    ('stripe_fee_percentage', '2.9', 'Stripe percentage fee', 'payment_processing'),
    ('minimum_payout_cents', '1000', 'Minimum payout amount in cents ($10)', 'payouts'),
    ('payout_frequency_days', '7', 'Payout frequency in days', 'payouts')
ON CONFLICT (key) DO NOTHING;

-- Insert default feature flags
INSERT INTO public.feature_flags (key, name, description, type, default_value) VALUES
    ('intro_sku_enabled', 'Intro SKU Enabled', 'Enable introductory pricing for new users', 'boolean', 'true'),
    ('elevenlabs_enabled', 'ElevenLabs Voices', 'Enable ElevenLabs voice generation', 'boolean', 'true'),
    ('custom_voice_upload', 'Custom Voice Upload', 'Allow users to upload custom voices', 'boolean', 'false'),
    ('solfeggio_frequencies', 'Solfeggio Frequencies', 'Enable Solfeggio frequency add-ons', 'boolean', 'true'),
    ('binaural_beats', 'Binaural Beats', 'Enable binaural beats add-ons', 'boolean', 'true'),
    ('background_music', 'Background Music', 'Enable background music selection', 'boolean', 'true'),
    ('max_script_length', 'Max Script Length', 'Maximum script length in characters', 'number', '5000'),
    ('max_renders_per_day', 'Max Renders Per Day', 'Maximum renders allowed per day', 'number', '10'),
    ('priority_queue', 'Priority Queue', 'Enable priority render queue for premium users', 'boolean', 'false'),
    ('seller_registration', 'Seller Registration', 'Allow users to register as sellers', 'boolean', 'true')
ON CONFLICT (key) DO NOTHING;

-- Insert default pricing tiers
INSERT INTO public.pricing_tiers (name, slug, description, price_cents, interval, features, position) VALUES
    ('Free', 'free', 'Get started with basic features', 0, 'one_time',
     '["3 renders per month", "Basic voices", "Standard queue", "Community support"]', 0),
    ('Starter', 'starter', 'Perfect for personal use', 999, 'monthly',
     '["20 renders per month", "All voices", "Priority queue", "Email support", "Background music"]', 1),
    ('Pro', 'pro', 'For content creators and professionals', 2999, 'monthly',
     '["Unlimited renders", "Custom voices", "Fastest queue", "Priority support", "All add-ons included", "API access"]', 2),
    ('Enterprise', 'enterprise', 'Custom solutions for teams', 0, 'monthly',
     '["Custom volume pricing", "Dedicated support", "SLA guarantee", "Custom integrations", "White-label options"]', 3)
ON CONFLICT (slug) DO NOTHING;

-- Create helper function to get user's feature access
CREATE OR REPLACE FUNCTION public.get_user_feature_access(user_id UUID, feature_key TEXT)
RETURNS JSONB AS $$
DECLARE
    tier_id UUID;
    feature_value JSONB;
    tier_override JSONB;
    default_val JSONB;
BEGIN
    -- Get user's current tier
    SELECT us.tier_id INTO tier_id
    FROM public.user_subscriptions us
    WHERE us.user_id = get_user_feature_access.user_id
    AND us.status IN ('active', 'trialing')
    ORDER BY us.created_at DESC
    LIMIT 1;

    -- Get feature flag
    SELECT
        ff.default_value,
        ff.tier_overrides
    INTO
        default_val,
        tier_override
    FROM public.feature_flags ff
    WHERE ff.key = feature_key
    AND ff.is_active = true;

    -- Check for tier-specific override
    IF tier_id IS NOT NULL AND tier_override IS NOT NULL THEN
        feature_value := tier_override->tier_id::text;
    END IF;

    -- Fall back to default if no override
    IF feature_value IS NULL THEN
        feature_value := default_val;
    END IF;

    RETURN feature_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for admin pricing dashboard
CREATE OR REPLACE VIEW public.pricing_dashboard AS
SELECT
    pt.id,
    pt.name,
    pt.slug,
    pt.price_cents,
    pt.interval,
    pt.is_active,
    COUNT(DISTINCT us.user_id) as subscriber_count,
    SUM(CASE WHEN us.status = 'active' THEN 1 ELSE 0 END) as active_subscribers,
    pt.position
FROM public.pricing_tiers pt
LEFT JOIN public.user_subscriptions us ON us.tier_id = pt.id
GROUP BY pt.id
ORDER BY pt.position;

-- Grant permissions for the view
GRANT SELECT ON public.pricing_dashboard TO authenticated;

COMMENT ON TABLE public.pricing_tiers IS 'Stores subscription tiers and pricing plans';
COMMENT ON TABLE public.feature_flags IS 'Stores feature flags and tier-specific overrides';
COMMENT ON TABLE public.pricing_configurations IS 'Stores global pricing configuration values';
COMMENT ON TABLE public.tier_features IS 'Junction table linking tiers to specific feature values';
COMMENT ON TABLE public.user_subscriptions IS 'Tracks user subscription status and history';
COMMENT ON TABLE public.pricing_audit_log IS 'Audit log for all pricing-related changes';