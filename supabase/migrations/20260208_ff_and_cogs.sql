-- Friends & Family Program + COGS Tracking Migration
-- 2026-02-08

-- 1. Add ff_tier to profiles (nullable = normal user)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ff_tier text CHECK (ff_tier IN ('inner_circle', 'cost_pass'));

-- 2. Add cogs_cents to purchases (default 0 for backward compat)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS cogs_cents integer DEFAULT 0;

-- 3. Create ff_invites table
CREATE TABLE IF NOT EXISTS ff_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  email       text NOT NULL,
  tier        text NOT NULL CHECK (tier IN ('inner_circle', 'cost_pass')),
  invited_by  uuid REFERENCES auth.users(id),
  status      text DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'revoked')),
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- Enable RLS but add NO public policies = admin/service-role only
ALTER TABLE ff_invites ENABLE ROW LEVEL SECURITY;

-- Index for fast code lookups during redemption
CREATE INDEX IF NOT EXISTS idx_ff_invites_code ON ff_invites(code);
CREATE INDEX IF NOT EXISTS idx_ff_invites_status ON ff_invites(status);

-- 4. COGS analytics RPC
CREATE OR REPLACE FUNCTION get_cogs_analytics(p_start timestamptz, p_end timestamptz)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(amount), 0),
    'total_cogs', COALESCE(SUM(cogs_cents), 0),
    'gross_margin', COALESCE(SUM(amount) - SUM(cogs_cents), 0),
    'margin_pct', CASE
      WHEN COALESCE(SUM(amount), 0) = 0 THEN 0
      ELSE ROUND(((SUM(amount) - SUM(cogs_cents))::numeric / SUM(amount)::numeric) * 100, 1)
    END,
    'purchase_count', COUNT(*),
    'by_type', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          COALESCE(metadata->>'type', 'unknown') as type,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as revenue,
          COALESCE(SUM(cogs_cents), 0) as cogs,
          CASE
            WHEN COALESCE(SUM(amount), 0) = 0 THEN 0
            ELSE ROUND(((SUM(amount) - SUM(cogs_cents))::numeric / SUM(amount)::numeric) * 100, 1)
          END as margin_pct
        FROM purchases
        WHERE status = 'completed'
          AND created_at >= p_start
          AND created_at < p_end
        GROUP BY COALESCE(metadata->>'type', 'unknown')
        ORDER BY SUM(amount) DESC
      ) t
    ),
    'over_time', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          date_trunc('day', created_at)::date as date,
          COALESCE(SUM(amount), 0) as revenue,
          COALESCE(SUM(cogs_cents), 0) as cogs
        FROM purchases
        WHERE status = 'completed'
          AND created_at >= p_start
          AND created_at < p_end
        GROUP BY date_trunc('day', created_at)::date
        ORDER BY date
      ) t
    ),
    'ff_impact', (
      SELECT json_build_object(
        'ff_user_count', (SELECT COUNT(*) FROM profiles WHERE ff_tier IS NOT NULL),
        'inner_circle_count', (SELECT COUNT(*) FROM profiles WHERE ff_tier = 'inner_circle'),
        'cost_pass_count', (SELECT COUNT(*) FROM profiles WHERE ff_tier = 'cost_pass'),
        'ff_purchases', COALESCE(
          (SELECT COUNT(*) FROM purchases
           WHERE status = 'completed'
             AND created_at >= p_start
             AND created_at < p_end
             AND metadata->>'ff_tier' IS NOT NULL),
          0
        ),
        'ff_subsidized_cents', COALESCE(
          (SELECT SUM(cogs_cents) FROM purchases
           WHERE status = 'completed'
             AND created_at >= p_start
             AND created_at < p_end
             AND metadata->>'ff_tier' IS NOT NULL
             AND amount = 0),
          0
        )
      )
    )
  ) INTO result
  FROM purchases
  WHERE status = 'completed'
    AND created_at >= p_start
    AND created_at < p_end;

  RETURN result;
END;
$$;
