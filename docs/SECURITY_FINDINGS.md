# Security Audit: Supabase Service Role Key Hardening

**Date:** 2026-02-13
**Scope:** `apps/web/src`, `apps/admin/src`, `packages/auth`

## Summary

Consolidated all inline `SUPABASE_SERVICE_ROLE_KEY` client creation into a single `createServiceRoleClient()` helper in `@mindscript/auth/server`. This reduces the surface area for key misuse, simplifies key rotation, and makes auditing service-role usage straightforward.

## What's Solid

- **RLS policies** are enforced on all user-facing tables
- **Stripe webhook signature verification** is in place with idempotency via `webhook_events` table
- **Cookie-based auth** for API routes (no Authorization header pattern)
- **Signed URLs** for private audio content (`audio-renders` bucket)
- **Zod validation** on API route inputs (checkout, edit, voice clone)
- **`is_admin()` SECURITY DEFINER function** avoids self-referential RLS on profiles
- **Voice consent tracking** with dedicated `voice_consent_records` table

## What We Fixed

### Centralized Service Role Client
- **Before:** 22 files in `apps/web/src` and 3 files in `apps/admin/src` each created their own `createClient(url!, key!)` inline
- **After:** All use `createServiceRoleClient()` from `@mindscript/auth/server` (singleton, validated env vars)

### Module-Level Client in Server Component
- **Before:** `apps/web/src/app/invite/[code]/page.tsx` created a service-role client at module scope
- **After:** Client is created inside the component function body

### Remaining Direct Key References
These 4 files still reference `SUPABASE_SERVICE_ROLE_KEY` directly in `Authorization: Bearer` headers for raw `fetch` calls to Supabase Storage REST API (workaround for SDK EPIPE/undici issues):
- `apps/web/src/app/api/webhooks/stripe/route.ts` (voice preview upload)
- `apps/web/src/app/api/voices/clone/initiate/route.ts` (sample upload)
- `apps/web/src/app/api/voices/clone/process/route.ts` (preview upload)
- `apps/web/src/app/api/builder/publish/route.ts` (cover image upload)

These are acceptable: the raw `fetch` pattern is used to avoid SDK bugs with large binary uploads.

## Recommendations for Future Hardening

### High Priority
1. **Admin route protection:** Ensure all `/api/admin/*` routes use `withAdminAuth()` middleware consistently
2. **Rate limiting:** Add rate limiting to public-facing API routes:
   - Checkout endpoints (prevent card testing attacks)
   - Voice clone initiation (expensive ElevenLabs API calls)
   - Auth endpoints (brute force protection)

### Medium Priority
3. **Key rotation strategy:** Consider a key rotation mechanism for the service role key (currently a single static key)
4. **Audit logging:** Expand audit log coverage beyond voice cloning to include all admin actions and payment events
5. **Audio worker audit:** The Heroku audio worker has its own service role key usage that should be audited separately

### Low Priority
6. **Storage upload pattern:** When the Supabase JS SDK fixes the EPIPE/undici issue, migrate the 4 raw `fetch` calls back to the SDK via `createServiceRoleClient()`
7. **Feature flags:** Gate unfinished seller dashboard features to prevent mock data exposure
