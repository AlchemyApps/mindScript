-- Admin Activity Log
-- Tracks administrative actions performed in the platform

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_id
    ON public.admin_activity_log(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at
    ON public.admin_activity_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action
    ON public.admin_activity_log(action);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_entity
    ON public.admin_activity_log(entity_type, entity_id)
    WHERE entity_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs"
    ON public.admin_activity_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- Service role can insert activity logs
CREATE POLICY "Service role can insert activity logs"
    ON public.admin_activity_log
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Admins can insert their own activity logs
CREATE POLICY "Admins can insert their own activity logs"
    ON public.admin_activity_log
    FOR INSERT
    WITH CHECK (
        auth.uid() = admin_id
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- Grant permissions
GRANT SELECT ON public.admin_activity_log TO authenticated;
GRANT INSERT ON public.admin_activity_log TO authenticated;
GRANT ALL ON public.admin_activity_log TO service_role;

-- Add helpful comments
COMMENT ON TABLE public.admin_activity_log IS 'Audit log of administrative actions performed in the platform';
COMMENT ON COLUMN public.admin_activity_log.action IS 'Type of action performed (e.g., resend_onboarding, update_pricing, suspend_user)';
COMMENT ON COLUMN public.admin_activity_log.entity_type IS 'Type of entity acted upon (e.g., seller_agreement, pricing_tier, user)';
COMMENT ON COLUMN public.admin_activity_log.entity_id IS 'UUID of the specific entity acted upon';
COMMENT ON COLUMN public.admin_activity_log.metadata IS 'Additional structured data about the action (e.g., old/new values, request details)';
