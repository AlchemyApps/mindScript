# MindScript Feature Plan

## Overview

Four features to implement:
1. Background Music Catalog (for end-to-end testing)
2. Fast Checkout with Stripe Link
3. Track Editing with Volume Controls
4. Custom Voice Cloning ($29)

---

## Feature 1: Background Music Catalog

### Goal
Add real background music files to the catalog so the full builder → checkout → render → library flow can be tested.

### Tasks
1. **Get music files from user** - User provides MP3/WAV files
2. **Upload to Supabase Storage** - `background-music` bucket
3. **Add to database** - Insert into `background_music` table with metadata (name, duration, category, price)
4. **Verify in builder** - Music appears in EnhanceStep picker

### User Action Required
- Provide the background music files (MP3/WAV)
- Specify name, category, and price for each

---

## Feature 2: Fast Checkout (Stripe Link)

### Goal
Returning customers have payment info pre-filled for one-click checkout.

### How It Works
- Stripe Link automatically saves customer email + payment method
- On subsequent checkouts, customers enter email → auto-fills card
- We enhance by saving Stripe Customer ID for logged-in users

### Tasks
1. Add `stripe_customer_id` column to `profiles` table
2. Update webhook to save Stripe customer ID after first purchase
3. Update checkout route to pass `customer` param if user has existing Stripe ID
4. Stripe Link handles the rest automatically

### Files to Modify
- Migration: add stripe_customer_id to profiles
- `apps/web/src/app/api/webhooks/stripe/route.ts`
- `apps/web/src/app/api/checkout/guest-conversion/route.ts`

---

## Feature 3: Track Editing with Volume Controls

### Goal
Allow users to edit their purchased tracks:
- Adjust volumes (voice, music, solfeggio, binaural)
- Change settings (loop, duration)
- Add/remove premium features
- First 3 edits FREE, then $0.49 + premium upgrade fees

### Pricing Model
| Scenario | Price |
|----------|-------|
| Edit 1-3 | FREE |
| Edit 4+ | $0.49 (admin-configurable) |
| Add premium voice | + voice tier fee |
| Add premium music | + music price |
| Add solfeggio | + solfeggio price |
| Add binaural | + binaural price |
| Remove/downgrade | No refund |

### Database Changes
```sql
-- Add edit tracking to tracks table
ALTER TABLE tracks ADD COLUMN edit_count INTEGER DEFAULT 0;
ALTER TABLE tracks ADD COLUMN original_config JSONB;

-- Admin settings table for configurable pricing
CREATE TABLE admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO admin_settings (key, value) VALUES
  ('edit_fee_cents', '49'),
  ('free_edit_limit', '3');
```

### Volume Controls (dB ranges)
| Layer | Default | Range | Step |
|-------|---------|-------|------|
| Voice | -1 dB | -12 to +3 | 1 |
| Music | -10 dB | -24 to 0 | 1 |
| Solfeggio | -18 dB | -30 to -6 | 1 |
| Binaural | -20 dB | -30 to -6 | 1 |

### New Files
- `apps/web/src/app/library/[trackId]/edit/page.tsx` - Edit page
- `apps/web/src/components/library/TrackEditor.tsx` - Volume controls UI
- `apps/web/src/components/library/VolumeSlider.tsx` - Slider component
- `apps/web/src/app/api/tracks/[trackId]/edit-eligibility/route.ts`
- `apps/web/src/app/api/tracks/[trackId]/edit/route.ts`
- `apps/web/src/app/api/checkout/track-edit/route.ts`

### Edit Flow
1. User clicks "Edit" on track in library
2. Opens edit page with current settings + volume sliders
3. User makes changes
4. System calculates price:
   - If edit 1-3 and no premium upgrades → FREE, re-render immediately
   - If edit 4+ or has premium upgrades → Show price, go to checkout
5. After payment (or free), create new render job
6. Replace track audio with new render

---

## Feature 4: Custom Voice Cloning ($29)

### Goal
Users can clone their own voice for $29 one-time fee, then use it on any track.

### Flow
1. User clicks "Create Your Voice" in VoicePicker
2. Opens VoiceCloneModal wizard:
   - Step 1: Introduction (explain feature, $29 price)
   - Step 2: Consent (6 required checkboxes per ElevenLabs requirements)
   - Step 3: Recording (record or upload 60-180 seconds of audio)
   - Step 4: Review (playback, quality check)
   - Step 5: Payment (Stripe Checkout for $29)
   - Step 6: Processing (call ElevenLabs clone API)
   - Step 7: Preview & Name (hear clone, set display name)
   - Step 8: Complete (voice available in builder)

### Database Changes
```sql
CREATE TABLE custom_voices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  elevenlabs_voice_id TEXT NOT NULL,
  preview_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE custom_voices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own custom voices" ON custom_voices
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own custom voices" ON custom_voices
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Stripe Product
- Product: "Custom Voice Setup"
- Price: $29.00 one-time

### New Files
- `apps/web/src/components/builder/VoiceCloneModal.tsx` - Multi-step wizard
- `apps/web/src/components/builder/VoiceRecorder.tsx` - Audio recording UI
- `apps/web/src/components/builder/ConsentCheckboxes.tsx` - ElevenLabs consent
- `apps/web/src/app/api/voices/clone/initiate/route.ts`
- `apps/web/src/app/api/voices/clone/process/route.ts`
- `apps/web/src/app/api/voices/custom/route.ts`

### Files to Modify
- `apps/web/src/components/builder/VoicePicker.tsx` - Add "Create Your Voice" button

---

## Implementation Order

### Phase 1: Background Music (enables full testing)
1. Upload user's music files to Supabase Storage
2. Insert into background_music table
3. Verify in builder UI

### Phase 2: Fast Checkout
1. Migration: add stripe_customer_id to profiles
2. Update webhook to save customer ID
3. Update checkout to pass customer param

### Phase 3: Track Editing
1. Migration: edit_count, original_config, admin_settings
2. Build TrackEditor component with volume sliders
3. Build edit page
4. Build API routes for edit flow
5. Build checkout route for paid edits

### Phase 4: Custom Voice Cloning
1. Migration: custom_voices table
2. Create $29 Stripe product
3. Build VoiceCloneModal wizard
4. Build VoiceRecorder component
5. Build clone API routes
6. Update VoicePicker to show custom voices

---

## Verification Checklist

### Background Music
- [ ] Music files uploaded to Supabase Storage
- [ ] Music appears in EnhanceStep picker
- [ ] Selected music plays in preview
- [ ] Music included in final rendered track

### Fast Checkout
- [ ] First purchase creates Stripe customer
- [ ] Customer ID saved to profiles
- [ ] Second purchase pre-fills payment info

### Track Editing
- [ ] Edit button opens edit page (not old screen)
- [ ] Volume sliders work and show dB values
- [ ] Edit 1-3 are free (no checkout)
- [ ] Edit 4+ shows $0.49 fee
- [ ] Premium upgrades add correct fees
- [ ] Track re-renders with new settings

### Custom Voice Cloning
- [ ] "Create Your Voice" button in VoicePicker
- [ ] Modal wizard flows through all steps
- [ ] Audio recording/upload works
- [ ] $29 checkout processes
- [ ] ElevenLabs clone API works
- [ ] Custom voice appears in builder
