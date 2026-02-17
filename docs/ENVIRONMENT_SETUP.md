# MindScript Environment Setup Guide

## Prerequisites

- Node.js 20+ and npm
- Supabase account with projects created
- Stripe account (for payments)
- Vercel account (for deployment)

## Environment Configuration

### 1. Copy Environment Template

```bash
cp .env.example .env.local
```

### 2. Configure Supabase (CRITICAL)

You need TWO Supabase projects:
- **DEV**: byicqjniboevzbhbfxui
- **PROD**: `tjuvcfiefebtanqlfalk`

For each project, obtain from Supabase Dashboard:
- Project URL
- Anon Key (public)
- Service Role Key (secret)

### 3. Apply Database Migrations

Apply all migrations from `supabase/migrations/` using the Supabase CLI:

```bash
# Dev (already applied)
supabase db push --db-url <DEV_DATABASE_URL> --include-all

# Prod (new project — run all 38 migrations)
supabase db push --db-url <PROD_DATABASE_URL> --include-all
```

Alternatively, apply manually via Supabase SQL Editor:

1. Go to Supabase Dashboard SQL Editor:
   - DEV: https://supabase.com/dashboard/project/byicqjniboevzbhbfxui/sql
   - PROD: https://supabase.com/dashboard/project/<PROD_PROJECT_REF>/sql

2. Copy the entire contents of `supabase/migrations/20240101000000_initial_security_setup.sql`

3. Paste and execute in the SQL editor for BOTH environments

4. Verify migration success by checking:
   - Tables created: profiles, scripts, audio_projects, renders, payments, etc.
   - RLS policies enabled
   - Storage buckets created

### 4. Configure Storage Buckets

After migrations, verify these storage buckets exist in both environments:

| Bucket | Public | Purpose | Max Size |
|--------|--------|---------|----------|
| avatars | Yes | User profile pictures | 5MB |
| audio-uploads | No | User audio uploads | 100MB |
| audio-renders | No | Generated audio files | 150MB |

Additional buckets to create manually:
- **background-music**: Store background music tracks (private, 50MB)
- **thumbnails**: Store script thumbnails (public, 2MB)
- **published**: Published scripts (public, 150MB)
- **previews**: Audio previews (public, 10MB)

### 5. Configure Stripe

1. Get your Stripe keys from https://dashboard.stripe.com/apikeys
2. Set up webhooks for:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

### 6. Configure Other Services

- **ElevenLabs**: API key for TTS
- **OpenAI**: API key for content generation
- **Resend**: API key for emails
- **Sentry**: DSN for error tracking

## Environment Variables Reference

```bash
# Supabase DEV
NEXT_PUBLIC_SUPABASE_URL=https://byicqjniboevzbhbfxui.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_dev_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_dev_service_role_key

# Supabase PROD (replace with new prod project URL)
SUPABASE_PROD_URL=https://<PROD_PROJECT_REF>.supabase.co
SUPABASE_PROD_ANON_KEY=your_prod_anon_key
SUPABASE_PROD_SERVICE_ROLE_KEY=your_prod_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# External Services
ELEVENLABS_API_KEY=your_key
OPENAI_API_KEY=your_key
RESEND_API_KEY=your_key
SENTRY_DSN=your_dsn

# Vercel (for deployments)
VERCEL_TOKEN=your_token
```

## Heroku Audio Worker (Dual-Environment)

The audio worker runs a single Heroku dyno that serves both dev and prod Supabase databases. Prod jobs are prioritized.

### Worker Environment Variables

```bash
# Dev database
SUPABASE_DEV_URL=https://byicqjniboevzbhbfxui.supabase.co
SUPABASE_DEV_SERVICE_ROLE_KEY=<dev-service-key>

# Prod database (enables dual mode)
SUPABASE_PROD_URL=https://<PROD_PROJECT_REF>.supabase.co
SUPABASE_PROD_SERVICE_ROLE_KEY=<prod-service-key>

# Shared
OPENAI_API_KEY=<key>
ELEVENLABS_API_KEY=<key>
```

The worker falls back to `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` for dev if the new `_DEV_` vars aren't set, so existing deployments continue working without changes.

### Deploy Sequence

1. Deploy worker code to Heroku (backwards compatible with dev-only config)
2. Verify worker still processes dev jobs
3. Add prod vars: `heroku config:set SUPABASE_PROD_URL=... SUPABASE_PROD_SERVICE_ROLE_KEY=...`
4. Restart and verify `/health` shows both environments enabled

### Health Check

```bash
curl https://<heroku-app>.herokuapp.com/health
```

Response includes per-environment stats:
```json
{
  "status": "healthy",
  "environments": {
    "dev": { "enabled": true, "totalProcessed": 5, "totalFailed": 0 },
    "prod": { "enabled": true, "totalProcessed": 12, "totalFailed": 1 }
  }
}
```

## Testing Your Setup

Run the health check script:

```bash
npm run check:env
```

This will verify:
- ✅ All required environment variables are set
- ✅ Supabase connections work
- ✅ Database tables exist
- ✅ Storage buckets are configured
- ✅ External service connections

## Common Issues

### MCP Server Issues

If MCP servers show "read-only" or "unauthorized" errors:
1. Restart Claude Desktop
2. Ensure access tokens are set in `.env.local`
3. Use the Supabase Dashboard for manual operations

### Migration Failures

If migrations fail to apply:
1. Check for existing tables (might already be applied)
2. Run statements individually in SQL editor
3. Verify service role key has admin permissions

### Storage Bucket Issues

If storage operations fail:
1. Verify buckets exist in Dashboard
2. Check RLS policies on storage.objects table
3. Ensure service role key is used for admin operations

## Next Steps

1. Run seed data script: `npm run seed`
2. Start development server: `npm run dev`
3. Test authentication flow
4. Test payment flow with Stripe test cards
5. Test audio rendering pipeline

## Support

- Supabase Docs: https://supabase.com/docs
- Stripe Docs: https://stripe.com/docs
- Project Issues: GitHub Issues