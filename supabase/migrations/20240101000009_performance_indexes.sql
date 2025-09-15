-- Performance optimization indexes for MindScript database
-- These indexes improve query performance for common access patterns

-- User queries optimization
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON public.users(subscription_status) WHERE subscription_status IS NOT NULL;

-- Audio tracks performance
CREATE INDEX IF NOT EXISTS idx_audio_tracks_user_id ON public.audio_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_created_at ON public.audio_tracks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_status ON public.audio_tracks(status);
CREATE INDEX IF NOT EXISTS idx_audio_tracks_published ON public.audio_tracks(is_published, created_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_audio_tracks_seller ON public.audio_tracks(seller_id, is_published) WHERE seller_id IS NOT NULL;

-- Composite index for marketplace queries
CREATE INDEX IF NOT EXISTS idx_audio_tracks_marketplace
ON public.audio_tracks(is_published, price, created_at DESC)
WHERE is_published = true AND price IS NOT NULL;

-- Audio jobs queue optimization
CREATE INDEX IF NOT EXISTS idx_audio_jobs_status_priority
ON public.audio_jobs(status, priority DESC, created_at)
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_audio_jobs_user_status
ON public.audio_jobs(user_id, status, created_at DESC);

-- Purchases and transactions
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_seller_id ON public.purchases(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_track_id ON public.purchases(track_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON public.purchases(status) WHERE status != 'completed';

-- Seller payouts optimization
CREATE INDEX IF NOT EXISTS idx_seller_payouts_seller_id ON public.seller_payouts(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_status ON public.seller_payouts(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_seller_payouts_scheduled ON public.seller_payouts(scheduled_date, status) WHERE status = 'pending';

-- Webhook events deduplication
CREATE INDEX IF NOT EXISTS idx_webhook_events_idempotency
ON public.webhook_events(webhook_id, event_id)
WHERE processed = false;

-- Background music catalog
CREATE INDEX IF NOT EXISTS idx_background_tracks_category ON public.background_tracks(category, is_active);
CREATE INDEX IF NOT EXISTS idx_background_tracks_mood ON public.background_tracks(mood) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_background_tracks_usage ON public.background_tracks(usage_count DESC);

-- User libraries optimization
CREATE INDEX IF NOT EXISTS idx_user_library_user_track
ON public.user_library(user_id, track_id);

CREATE INDEX IF NOT EXISTS idx_user_library_user_created
ON public.user_library(user_id, created_at DESC);

-- Playlists optimization
CREATE INDEX IF NOT EXISTS idx_playlists_user ON public.playlists(user_id, is_public);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_order ON public.playlist_tracks(playlist_id, position);

-- Analytics and metrics (partial indexes for hot data)
CREATE INDEX IF NOT EXISTS idx_track_plays_recent
ON public.track_plays(track_id, played_at DESC)
WHERE played_at > NOW() - INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_track_plays_user_recent
ON public.track_plays(user_id, played_at DESC)
WHERE played_at > NOW() - INTERVAL '7 days';

-- Text search optimization for marketplace
CREATE INDEX IF NOT EXISTS idx_audio_tracks_search
ON public.audio_tracks
USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')))
WHERE is_published = true;

-- Add index for seller profile lookups
CREATE INDEX IF NOT EXISTS idx_seller_profiles_stripe_account
ON public.seller_profiles(stripe_account_id)
WHERE stripe_account_id IS NOT NULL;

-- Optimize RLS policy checks
CREATE INDEX IF NOT EXISTS idx_audio_tracks_rls_check
ON public.audio_tracks(user_id, is_published, seller_id);

-- Statistics update to help query planner
ANALYZE public.users;
ANALYZE public.audio_tracks;
ANALYZE public.audio_jobs;
ANALYZE public.purchases;
ANALYZE public.seller_payouts;
ANALYZE public.webhook_events;
ANALYZE public.background_tracks;
ANALYZE public.user_library;
ANALYZE public.playlists;
ANALYZE public.playlist_tracks;
ANALYZE public.track_plays;
ANALYZE public.seller_profiles;

-- Add comment for documentation
COMMENT ON INDEX idx_audio_tracks_marketplace IS 'Optimizes marketplace browsing queries for published tracks with prices';
COMMENT ON INDEX idx_audio_jobs_status_priority IS 'Optimizes job queue processing by status and priority';
COMMENT ON INDEX idx_track_plays_recent IS 'Partial index for recent analytics queries (30 day window)';
COMMENT ON INDEX idx_audio_tracks_search IS 'Full text search index for track discovery in marketplace';