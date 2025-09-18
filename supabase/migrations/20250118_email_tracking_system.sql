-- Email Tracking and Unsubscribe System

-- Create email logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    to_email TEXT NOT NULL,
    template TEXT NOT NULL,
    status TEXT CHECK (status IN ('sent', 'queued', 'failed', 'bounced', 'complained')) NOT NULL,
    resend_id TEXT,
    error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create email preferences table for unsubscribe management
CREATE TABLE IF NOT EXISTS public.email_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    marketing_emails BOOLEAN NOT NULL DEFAULT true,
    transactional_emails BOOLEAN NOT NULL DEFAULT true,
    seller_notifications BOOLEAN NOT NULL DEFAULT true,
    purchase_notifications BOOLEAN NOT NULL DEFAULT true,
    render_notifications BOOLEAN NOT NULL DEFAULT true,
    moderation_notifications BOOLEAN NOT NULL DEFAULT true,
    unsubscribe_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id),
    UNIQUE(email)
);

-- Create email bounces table
CREATE TABLE IF NOT EXISTS public.email_bounces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft', 'complaint')) NOT NULL,
    bounce_subtype TEXT,
    description TEXT,
    resend_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create email templates configuration table
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    subject_template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    category TEXT NOT NULL DEFAULT 'transactional',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX idx_email_logs_to_email ON public.email_logs(to_email);
CREATE INDEX idx_email_logs_template ON public.email_logs(template);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);

CREATE INDEX idx_email_preferences_email ON public.email_preferences(email);
CREATE INDEX idx_email_preferences_unsubscribe_token ON public.email_preferences(unsubscribe_token);

CREATE INDEX idx_email_bounces_email ON public.email_bounces(email);
CREATE INDEX idx_email_bounces_bounce_type ON public.email_bounces(bounce_type);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_bounces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_logs
-- Users can see their own email logs
CREATE POLICY "Users can view own email logs"
    ON public.email_logs FOR SELECT
    USING (user_id = auth.uid());

-- Admins can view all email logs
CREATE POLICY "Admins can view all email logs"
    ON public.email_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- System can insert email logs
CREATE POLICY "System can insert email logs"
    ON public.email_logs FOR INSERT
    WITH CHECK (true);

-- RLS Policies for email_preferences
-- Users can manage their own preferences
CREATE POLICY "Users can manage own email preferences"
    ON public.email_preferences FOR ALL
    USING (user_id = auth.uid());

-- Public can update preferences with unsubscribe token
CREATE POLICY "Public can unsubscribe with token"
    ON public.email_preferences FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- RLS Policies for email_bounces
-- Only admins can view bounces
CREATE POLICY "Admins can view email bounces"
    ON public.email_bounces FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- System can insert bounces
CREATE POLICY "System can insert email bounces"
    ON public.email_bounces FOR INSERT
    WITH CHECK (true);

-- RLS Policies for email_templates
-- Everyone can read active templates
CREATE POLICY "Public can read active email templates"
    ON public.email_templates FOR SELECT
    USING (is_active = true);

-- Admins can manage templates
CREATE POLICY "Admins can manage email templates"
    ON public.email_templates FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Functions
-- Function to get user email preferences
CREATE OR REPLACE FUNCTION public.get_user_email_preferences(p_user_id UUID)
RETURNS TABLE (
    marketing_emails BOOLEAN,
    transactional_emails BOOLEAN,
    seller_notifications BOOLEAN,
    purchase_notifications BOOLEAN,
    render_notifications BOOLEAN,
    moderation_notifications BOOLEAN,
    unsubscribe_token TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ep.marketing_emails,
        ep.transactional_emails,
        ep.seller_notifications,
        ep.purchase_notifications,
        ep.render_notifications,
        ep.moderation_notifications,
        ep.unsubscribe_token
    FROM public.email_preferences ep
    WHERE ep.user_id = p_user_id;

    -- If no preferences exist, return defaults
    IF NOT FOUND THEN
        -- Create default preferences
        INSERT INTO public.email_preferences (
            user_id,
            email,
            unsubscribe_token
        )
        SELECT
            p_user_id,
            u.email,
            gen_random_uuid()::text
        FROM auth.users u
        WHERE u.id = p_user_id;

        -- Return the newly created preferences
        RETURN QUERY
        SELECT
            ep.marketing_emails,
            ep.transactional_emails,
            ep.seller_notifications,
            ep.purchase_notifications,
            ep.render_notifications,
            ep.moderation_notifications,
            ep.unsubscribe_token
        FROM public.email_preferences ep
        WHERE ep.user_id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if email should be sent
CREATE OR REPLACE FUNCTION public.should_send_email(
    p_email TEXT,
    p_template TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_preferences RECORD;
    v_is_bounced BOOLEAN;
BEGIN
    -- Check if email is hard bounced
    SELECT EXISTS (
        SELECT 1 FROM public.email_bounces
        WHERE email = p_email
        AND bounce_type = 'hard'
    ) INTO v_is_bounced;

    IF v_is_bounced THEN
        RETURN FALSE;
    END IF;

    -- Get user preferences
    SELECT * INTO v_preferences
    FROM public.email_preferences
    WHERE email = p_email;

    -- If no preferences, allow sending
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;

    -- Check template-specific preferences
    CASE p_template
        WHEN 'marketing' THEN
            RETURN v_preferences.marketing_emails;
        WHEN 'purchase-confirmation' THEN
            RETURN v_preferences.purchase_notifications;
        WHEN 'render-complete' THEN
            RETURN v_preferences.render_notifications;
        WHEN 'seller-payout' THEN
            RETURN v_preferences.seller_notifications;
        WHEN 'moderation' THEN
            RETURN v_preferences.moderation_notifications;
        ELSE
            -- For transactional emails (password reset, welcome, etc)
            RETURN v_preferences.transactional_emails;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle unsubscribe
CREATE OR REPLACE FUNCTION public.handle_unsubscribe(
    p_token TEXT,
    p_categories TEXT[] DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_preferences RECORD;
BEGIN
    -- Find preferences by token
    SELECT * INTO v_preferences
    FROM public.email_preferences
    WHERE unsubscribe_token = p_token;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- If no specific categories, unsubscribe from all marketing
    IF p_categories IS NULL THEN
        UPDATE public.email_preferences
        SET
            marketing_emails = FALSE,
            seller_notifications = FALSE,
            unsubscribed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE unsubscribe_token = p_token;
    ELSE
        -- Unsubscribe from specific categories
        UPDATE public.email_preferences
        SET
            marketing_emails = CASE
                WHEN 'marketing' = ANY(p_categories) THEN FALSE
                ELSE marketing_emails
            END,
            seller_notifications = CASE
                WHEN 'seller' = ANY(p_categories) THEN FALSE
                ELSE seller_notifications
            END,
            purchase_notifications = CASE
                WHEN 'purchase' = ANY(p_categories) THEN FALSE
                ELSE purchase_notifications
            END,
            render_notifications = CASE
                WHEN 'render' = ANY(p_categories) THEN FALSE
                ELSE render_notifications
            END,
            moderation_notifications = CASE
                WHEN 'moderation' = ANY(p_categories) THEN FALSE
                ELSE moderation_notifications
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE unsubscribe_token = p_token;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default email templates
INSERT INTO public.email_templates (template_key, name, subject_template, description, category) VALUES
    ('welcome', 'Welcome Email', 'Welcome to MindScript! 🎵', 'Sent to new users after registration', 'transactional'),
    ('purchase-confirmation', 'Purchase Confirmation', 'Your MindScript Purchase: {{trackTitle}}', 'Sent after successful purchase', 'transactional'),
    ('render-complete', 'Render Complete', 'Your track "{{trackTitle}}" is ready! 🎧', 'Sent when audio rendering is complete', 'transactional'),
    ('password-reset', 'Password Reset', 'Reset Your MindScript Password', 'Password reset request', 'transactional'),
    ('seller-payout', 'Seller Payout', 'Your MindScript payout of {{amount}} is on the way! 💰', 'Payout notification for sellers', 'transactional'),
    ('moderation-approved', 'Content Approved', 'Your content "{{contentTitle}}" has been approved! ✅', 'Content moderation approval', 'transactional'),
    ('moderation-rejected', 'Content Rejected', 'Important: Action required for "{{contentTitle}}"', 'Content moderation rejection', 'transactional'),
    ('moderation-flagged', 'Content Flagged', 'Your content "{{contentTitle}}" needs review', 'Content flagged for review', 'transactional'),
    ('subscription-renewal', 'Subscription Renewal', 'Your MindScript subscription has been renewed', 'Subscription renewal confirmation', 'transactional'),
    ('subscription-cancelled', 'Subscription Cancelled', 'Your MindScript subscription has been cancelled', 'Subscription cancellation confirmation', 'transactional')
ON CONFLICT (template_key) DO NOTHING;

-- Triggers
CREATE OR REPLACE FUNCTION public.update_email_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_preferences_updated_at
    BEFORE UPDATE ON public.email_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_email_preferences_updated_at();

CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_email_preferences_updated_at();

-- Create view for email statistics
CREATE OR REPLACE VIEW public.email_statistics AS
SELECT
    template,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE status = 'sent') as successful,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
    COUNT(*) FILTER (WHERE status = 'complained') as complained,
    DATE_TRUNC('day', created_at) as date
FROM public.email_logs
GROUP BY template, DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Grant permissions
GRANT SELECT ON public.email_statistics TO authenticated;

COMMENT ON TABLE public.email_logs IS 'Tracks all sent emails and their status';
COMMENT ON TABLE public.email_preferences IS 'User email notification preferences and unsubscribe management';
COMMENT ON TABLE public.email_bounces IS 'Tracks email bounces and complaints';
COMMENT ON TABLE public.email_templates IS 'Email template configuration and metadata';