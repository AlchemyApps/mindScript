# Session: F&F Invite QA Cleanup

**Date:** 2026-02-09
**Branch:** `feature/invite-qa`
**Status:** COMPLETE

## Fixes Implemented

### Fix 1: Voice Pricing Double-Counting Bug (CRITICAL)
- **Problem:** Voice fee was charged twice — once in `StepBuilder.calculateTotal()` (sent as `priceAmount`) and again as a separate Stripe line item by the backend.
- **Solution:** Removed voice fee from `StepBuilder.calculateTotal()`. Added voice fee as a visible line item in `CreateStep` so users see the correct total. Backend continues to add it as a Stripe line item.
- **Files:** `StepBuilder.tsx`, `CreateStep.tsx`

### Fix 2: F&F Custom Voice Clone — Free
- **Problem:** `voices/clone/initiate/route.ts` always created a $29 Stripe checkout with no F&F tier check.
- **Solution:** Added F&F tier check. Inner Circle and Cost Pass users skip Stripe, get a $0 purchase recorded, and voice cloning starts directly via ElevenLabs API. Updated `VoiceCloneShelf` UI to show "FREE" pricing for F&F users.
- **Files:** `voices/clone/initiate/route.ts`, `VoiceCloneShelf.tsx`

### Fix 3: Email Pre-Population for F&F Invites
- **Problem:** Invite email existed in `ff_invites.email` but was never passed to auth forms. Users had to manually type their invited email.
- **Solution:** Extended `AuthFormField` with `defaultValue`/`disabled`. Invite page passes email to client component. Signup and login pages pre-fill and lock the email field when `email` param is present.
- **Files:** `AuthForm.tsx`, `invite/[code]/page.tsx`, `InviteRedeemClient.tsx`, `signup/page.tsx`, `login/page.tsx`

### Fix 4: Remove Email Confirmation Screen
- **Problem:** After signup, users saw "Check your email for verification" screen. With email confirmation disabled in Supabase, this was unnecessary.
- **Solution:** Removed the verification UI block entirely. Signup now checks for session existence and redirects immediately to `redirectTo` or `/dashboard`.
- **Files:** `signup/page.tsx`
- **External dependency:** Email confirmation must be disabled in Supabase Dashboard (Authentication > Settings > Email Auth)

### Fix 5: Dashboard Page Redesign
- **Problem:** Dashboard used basic Card components with minimal content.
- **Solution:** Rewrote using design system: GlassCard, gradient icon containers, GradientButton with breathing/glow CTA, avatar initial, F&F tier badge, responsive 2-column grid.
- **Files:** `dashboard/page.tsx`

### Fix 6: Broken Link /create -> /builder
- **Problem:** "Start Creating" link after invite redemption pointed to `/create` (404).
- **Solution:** Changed to `/builder`.
- **Files:** `InviteRedeemClient.tsx`

### Fix 7: Login Redirect Param Mismatch
- **Problem:** Login page reads `redirectTo` param, but `InviteRedeemClient` sent `redirect`. Login never redirected back to the invite page.
- **Solution:** Changed `InviteRedeemClient` to use `redirectTo` in all redirect URLs, with `email` param included.
- **Files:** `InviteRedeemClient.tsx`

### Bonus: Voice Clone CTA Pricing for F&F
- **Problem:** VoiceCloneCTA showed "$29 one-time" for all users including F&F.
- **Solution:** Added `isFF` prop to `VoiceCloneCTA`, showing ~~$29~~ FREE for F&F users. Threaded prop through `VoiceStep`, `VoicePicker`, and the library/marketplace pages.
- **Files:** `VoiceCloneCTA.tsx`, `VoicePicker.tsx`, `VoiceStep.tsx`, `StepBuilder.tsx`, `library/page.tsx`, `marketplace/page.tsx`

## Files Changed (16 source files)

| File | Change |
|------|--------|
| `packages/ui/src/components/AuthForm.tsx` | Added `defaultValue`/`disabled` to field interface |
| `apps/web/src/components/builder/StepBuilder.tsx` | Removed voice fee from calculateTotal, pass isFF |
| `apps/web/src/components/builder/steps/CreateStep.tsx` | Added voice fee line item display |
| `apps/web/src/components/builder/steps/VoiceStep.tsx` | Added isFF prop passthrough |
| `apps/web/src/components/builder/VoicePicker.tsx` | Added isFF prop passthrough |
| `apps/web/src/components/builder/VoiceCloneCTA.tsx` | F&F pricing display (~~$29~~ FREE) |
| `apps/web/src/components/builder/VoiceCloneShelf.tsx` | F&F aware pricing, skipStripe handling |
| `apps/web/src/app/api/voices/clone/initiate/route.ts` | F&F tier check, skip Stripe, direct clone |
| `apps/web/src/app/invite/[code]/page.tsx` | Pass email to client component |
| `apps/web/src/app/invite/[code]/InviteRedeemClient.tsx` | Email prop, redirectTo fix, /builder link |
| `apps/web/src/app/auth/signup/page.tsx` | Email pre-fill, removed verification screen |
| `apps/web/src/app/auth/login/page.tsx` | Email pre-fill from params |
| `apps/web/src/app/dashboard/page.tsx` | Full redesign with design system |
| `apps/web/src/app/library/page.tsx` | F&F state + pass to VoiceCloneCTA |
| `apps/web/src/app/marketplace/page.tsx` | F&F state + pass to VoiceCloneCTA |

## Remaining / Follow-up
- Disable email confirmation in Supabase Dashboard if not already done
- Pre-existing build errors in unrelated files: `email/preview/route.ts`, `renders/[id]/cancel/route.ts`, `renders/[id]/status/route.ts` (missing modules)
- Package builds required before `npm run dev` (`packages/schemas`, `packages/types`, `packages/auth`, `packages/ui`)
