# Friends & Family Program Plan

## Overview
A two-tier system allowing selected people to use MindScript for free or at-cost, managed via invite codes sent by the founder.

### Tiers

| Tier | Track Creation | AI Costs | Selling (Stripe Connect) |
|------|---------------|----------|--------------------------|
| **Inner Circle** | Free | Free | 0% platform fee (only Stripe processing) |
| **Cost Pass** | Free (no platform fee) | Pay actual AI cost only (no markup) | Reduced platform fee (e.g., 5%) |

- No time limits on invites or tier access
- No usage caps
- Tier is silently applied — no badges, no visible indicator, pricing just reflects their status

---

## Data Model

### New table: `ff_invites`
```sql
CREATE TABLE ff_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  email       text NOT NULL,
  tier        text NOT NULL CHECK (tier IN ('inner_circle', 'cost_pass')),
  invited_by  uuid REFERENCES auth.users(id),
  status      text DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed')),
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_at timestamptz,
  created_at  timestamptz DEFAULT now()
);
```

### New column on `profiles`
```sql
ALTER TABLE profiles ADD COLUMN ff_tier text CHECK (ff_tier IN ('inner_circle', 'cost_pass'));
```

Defaults to `null` (normal user).

### RLS
- `ff_invites` — No public access. Admin-only via service role.
- `profiles.ff_tier` — Readable by the user themselves (needed for client-side price display). Writable only by service role.

---

## Invite Flow

### Admin Sends Invite
1. Admin page (in `apps/admin` or protected route in web app) with form: email + tier picker
2. `POST /api/admin/ff/invite` — generates unique code, inserts into `ff_invites`, sends email via Resend
3. Email is warm and personal: "Chris invited you to try MindScript" with a single CTA button linking to `/invite/[code]`

### Invitee Redeems

**If they already have an account (logged in):**
1. Click link → `/invite/[code]`
2. Page validates code (exists, not already redeemed)
3. "Activate" button → API sets `ff_tier` on their profile, marks invite as redeemed
4. Redirect to home — pricing silently reflects their tier

**If they don't have an account:**
1. Click link → `/invite/[code]`
2. Page validates code, explains what MindScript is
3. "Get Started" → sign up flow
4. Invite code stored in cookie or URL param through auth flow
5. On first login, callback/middleware detects pending code → applies tier automatically
6. Redirect to home

---

## Where Tier Is Checked (Runtime)

| Location | Inner Circle | Cost Pass | Normal User |
|----------|-------------|-----------|-------------|
| Track checkout creation | Skip ($0) | `calculateAICost()` | Full retail price |
| Voice clone checkout | Skip $29 | ElevenLabs API cost only | $29 |
| Track edit checkout | Skip edit fee | TTS cost only | Edit fee |
| Connect `application_fee_amount` | $0 | Reduced (e.g., 5%) | Standard rate |
| Usage limits (free edits, etc.) | Bypass | Bypass | Enforced |

If cost calculation rounds to $0.00 (e.g., very short track, no TTS), skip checkout entirely.

---

## At-Cost Calculation

A cost function that calculates actual AI spend per generation:

```
calculateAICost(trackConfig) → cents
  - TTS: character_count * elevenlabs_rate_per_char
  - Background music: $0 (already licensed/owned)
  - Binaural beats: $0 (generated locally via ffmpeg)
  - Rendering/compute: $0 (absorbed server cost)
```

**Location:** `apps/web/src/lib/pricing/cost-calculator.ts`

This is valuable beyond F&F — gives COGS data for every track, useful for margin analysis.

### Known AI Cost Rates (to be kept updated)
- ElevenLabs TTS: varies by plan tier and character count
- OpenAI (if used for script generation): per-token rate
- Other AI services: TBD

---

## Admin Management

Simple page with:
- Table of all F&F invites: email, tier, status, redeemed date
- "Invite" button → opens form (email + tier)
- "Revoke" action → sets `ff_tier = null` on the user's profile, updates invite status
- "Resend" action → re-sends email for pending invites

---

## Implementation Sequence

1. **Migration** — Create `ff_invites` table, add `ff_tier` column to `profiles`
2. **Cost calculator** — `calculateAICost()` service function
3. **Invite API** — `POST /api/admin/ff/invite` (generate code, store, send email)
4. **Redemption page** — `/invite/[code]` with logged-in and new-user flows
5. **Checkout integration** — Modify checkout creation to check `ff_tier` and adjust pricing
6. **Connect integration** — Modify `application_fee_amount` based on tier
7. **Admin page** — Table view + invite form + revoke/resend actions
8. **Email template** — Design the invite email via Resend

---

## Dependencies
- Resend (already integrated) for email delivery
- Supabase migration for schema changes
- Existing checkout flow (to add tier checks)
- Existing Stripe Connect flow (to adjust fees)
- Independent of mobile app plan — can be built in parallel
