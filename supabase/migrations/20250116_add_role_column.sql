-- Add role column to profiles table for admin access control
-- This migration adds a role column to distinguish between regular users and admins

-- Add role column with default value 'user'
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user'
CHECK (role IN ('user', 'admin', 'super_admin'));

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Update RLS policies for admin access
-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Allow admins to update all profiles
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id
        AND role IN ('admin', 'super_admin')
        AND account_status = 'active'
        AND deleted_at IS NULL
    );
END;
$$;

-- Create function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id
        AND (
            (required_role = 'admin' AND role IN ('admin', 'super_admin'))
            OR (required_role = 'super_admin' AND role = 'super_admin')
            OR (required_role = role)
        )
        AND account_status = 'active'
        AND deleted_at IS NULL
    );
END;
$$;

-- Create audit log table for admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action text NOT NULL,
    target_type text,
    target_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

-- Create index for audit log lookups
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

-- Enable RLS on audit log table
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view audit logs" ON public.admin_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- Function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_action text,
    p_target_type text DEFAULT NULL,
    p_target_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id uuid;
BEGIN
    -- Check if user is admin
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: User is not an admin';
    END IF;

    INSERT INTO public.admin_audit_logs (
        admin_id,
        action,
        target_type,
        target_id,
        metadata,
        ip_address,
        user_agent
    ) VALUES (
        auth.uid(),
        p_action,
        p_target_type,
        p_target_id,
        p_metadata,
        inet_client_addr(),
        current_setting('request.headers', true)::json->>'user-agent'
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- Add comment to explain the role column
COMMENT ON COLUMN public.profiles.role IS 'User role: user (default), admin (portal access), super_admin (full control)';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;