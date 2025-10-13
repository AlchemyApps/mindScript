# MindScript Authentication & First-Track Flow Implementation Guide

**Created:** 2025-01-30
**Status:** Ready for Implementation
**Project ID (Archon):** 6d363c98-a135-4919-8171-ee0756a6f1a0

---

## Overview

This document defines the complete authentication and first-track purchase flow for MindScript's guest builder. The flow ensures users are authenticated BEFORE payment, pricing is checked AFTER authentication, and all users (new signups and returning logins) follow the same pricing check logic.

---

## The Complete User Journey

### Step 1: User Builds Track on Homepage ✅
**Status:** Already working
**File:** `apps/web/src/components/guest-builder.tsx`

- User interacts with inline builder on landing page
- Configures: script, voice, duration, background music, solfeggio, binaural
- State automatically saves to localStorage
- No authentication required for building

### Step 2: User Clicks "Create Your First Track"
**Status:** Working, needs enhancement
**File:** `apps/web/src/components/guest-builder.tsx`

- Triggers `handleCheckout()` function
- Immediately checks: Is user authenticated?

### Step 3: Authentication Check
**Logic:**
```typescript
const handleCheckout = async () => {
  if (!user) {
    setShowAuthModal(true); // Proceed to Step 4
    return;
  }

  // User is already authenticated
  // Skip to Step 5 (Pricing Check)
  await checkPricingAndProceed();
};
```

### Step 4: Auth Modal Flow 🔧 NEEDS ENHANCEMENT
**Status:** Needs duplicate email detection
**File:** `apps/web/src/components/auth-modal.tsx`

#### 4a. User Chooses Signup or Login
- Modal displays toggle between "Sign Up" and "Sign In" tabs
- User enters:
  - **Signup:** email, password, full name
  - **Login:** email, password

#### 4b. Signup Flow with Duplicate Detection

```typescript
// Current code needs enhancement
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError(null);

  try {
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (error) {
        // ✅ ADD: Detect duplicate email
        if (error.message.includes('already registered') ||
            error.message.includes('already exists') ||
            error.message.includes('already been registered')) {

          // Auto-switch to login mode
          setMode('login');
          setError('This email is already registered. Please sign in instead.');
          setIsLoading(false);
          return; // Don't throw, just switch
        }
        throw error;
      }

      // User successfully created
      if (data?.user) {
        onAuthenticated(data.user); // Proceed to Step 5
      }
    } else {
      // Login flow (existing code works)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      if (data?.user) {
        onAuthenticated(data.user); // Proceed to Step 5
      }
    }
  } catch (error: any) {
    console.error('Auth error:', error);
    setError(error.message || 'An error occurred during authentication');
  } finally {
    setIsLoading(false);
  }
};
```

#### 4c. Result: User is Authenticated
**Regardless of signup or login path:**
- User account exists in Supabase
- User has active session
- `onAuthenticated(user)` callback is triggered
- Flow proceeds to Step 5

**Key Point:** User is in the system even if payment fails later.

### Step 5: Pricing Check 🔧 NEEDS IMPLEMENTATION
**Status:** Logic needs to move to AFTER authentication
**File:** `apps/web/src/components/guest-builder.tsx`

#### Current Problem:
Pricing check happens on page load, BEFORE user authenticates. This is wrong because we can't check `first_track_discount_used` without knowing who the user is.

#### Correct Implementation:

```typescript
const handleAuthSuccess = async (authenticatedUser: any) => {
  // 1. Save authenticated user to state
  setUser(authenticatedUser);
  setShowAuthModal(false);

  // 2. NOW check pricing eligibility (user is authenticated)
  try {
    const response = await fetch('/api/pricing/check-eligibility');
    if (!response.ok) {
      throw new Error('Failed to check pricing');
    }

    const pricingData = await response.json();

    // 3. Update pricing display
    setPricingInfo({
      basePrice: pricingData.pricing.basePrice / 100, // Convert cents to dollars
      discountedPrice: pricingData.pricing.discountedPrice / 100,
      savings: pricingData.pricing.savings / 100,
      isEligibleForDiscount: pricingData.isEligibleForDiscount
    });

    // 4. Alert user if they already used their discount
    if (!pricingData.isEligibleForDiscount) {
      alert(
        "You've already used your first-track discount.\n\n" +
        "Regular pricing ($2.99) applies, but you can still create amazing tracks!"
      );
    }

    // 5. Proceed to checkout with CORRECT pricing
    await proceedWithCheckout();

  } catch (error) {
    console.error('Error checking pricing:', error);
    // On error, still proceed but show message
    alert('Unable to verify pricing. Please contact support if you encounter issues.');
    await proceedWithCheckout();
  }
};
```

#### Pricing API Behavior:
**Endpoint:** `GET /api/pricing/check-eligibility`
**File:** `apps/web/src/app/api/pricing/check-eligibility/route.ts`

```typescript
// Current behavior (works correctly):
// 1. Checks if user is authenticated via Supabase session
// 2. Queries profiles table for first_track_discount_used
// 3. Returns:
{
  isEligibleForDiscount: boolean,
  pricing: {
    basePrice: 299,        // $2.99 in cents
    discountedPrice: 99,   // $0.99 in cents (if eligible)
    savings: 200,          // Difference
    currency: "USD"
  },
  userStatus: "new_user" | "existing_eligible" | "existing_ineligible"
}
```

### Step 6: Payment Flow 🔧 NEEDS ENHANCEMENT
**Status:** Working, needs to pass user_id
**File:** `apps/web/src/components/guest-builder.tsx`

#### Current proceedWithCheckout():
```typescript
const proceedWithCheckout = async () => {
  setIsProcessing(true);

  try {
    // ✅ ADD: Include user_id in request
    const checkoutData = {
      userId: user.id, // IMPORTANT: Pass authenticated user ID
      builderState: state,
      successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: window.location.href,
      priceAmount: Math.round(calculateTotal() * 100), // Use actual total, not hardcoded
      firstTrackDiscount: pricingInfo.isEligibleForDiscount, // Flag for webhook
    };

    const response = await fetch('/api/checkout/guest-conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutData)
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { url } = await response.json();

    // Redirect to Stripe Checkout
    window.location.href = url;
  } catch (error) {
    console.error('Checkout error:', error);
    alert('Failed to start checkout. Please try again.');
  } finally {
    setIsProcessing(false);
  }
};
```

### Step 7: Checkout API Enhancement 🔧 NEEDS IMPLEMENTATION
**Status:** Needs to accept and pass user_id
**File:** `apps/web/src/app/api/checkout/guest-conversion/route.ts`

#### Updates Needed:

```typescript
// Update request schema
const GuestCheckoutRequestSchema = z.object({
  userId: z.string().uuid(), // ✅ ADD: User ID from authenticated session
  builderState: z.object({
    // ... existing fields
  }),
  successUrl: z.string(),
  cancelUrl: z.string(),
  priceAmount: z.number(),
  firstTrackDiscount: z.boolean(), // ✅ ADD: Track if discount was used
});

// In Stripe session metadata
const metadata: Record<string, string> = {
  user_id: userId, // ✅ ADD: Critical for webhook
  conversion_type: 'guest_to_user',
  first_track_discount_used: firstTrackDiscount.toString(), // ✅ ADD
  // ... existing metadata
};
```

### Step 8: Stripe Payment ✅
**Status:** External, handled by Stripe
**No changes needed**

- User completes payment on Stripe Checkout
- Stripe processes payment
- On success, Stripe sends webhook to backend

### Step 9: Webhook Handler 🔧 NEEDS MAJOR ENHANCEMENT
**Status:** Needs complete guest conversion flow
**File:** `apps/web/src/app/api/webhooks/stripe/route.ts`

#### Implementation Needed:

```typescript
// Handle checkout.session.completed event
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;

  // Check if this is a first-track conversion
  if (session.metadata?.conversion_type === 'guest_to_user') {

    // 1. Extract user_id from metadata
    const userId = session.metadata.user_id;
    const firstTrackDiscount = session.metadata.first_track_discount_used === 'true';

    if (!userId) {
      console.error('Missing user_id in session metadata');
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    // 2. Reconstruct builder state from metadata
    const builderState = {
      script: reconstructScript(session.metadata), // Combine script_chunk_0, script_chunk_1, etc.
      voice: {
        provider: session.metadata.voice_provider,
        voice_id: session.metadata.voice_id,
        name: session.metadata.voice_name,
      },
      duration: parseInt(session.metadata.duration),
      backgroundMusic: session.metadata.background_music_id ? {
        id: session.metadata.background_music_id,
        name: session.metadata.background_music_name,
      } : undefined,
      solfeggio: session.metadata.solfeggio_frequency ? {
        enabled: true,
        frequency: parseInt(session.metadata.solfeggio_frequency),
      } : undefined,
      binaural: session.metadata.binaural_band ? {
        enabled: true,
        band: session.metadata.binaural_band,
      } : undefined,
    };

    // 3. Create track record
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .insert({
        user_id: userId,
        title: `Track - ${new Date().toLocaleDateString()}`, // Generate default title
        script: builderState.script,
        duration: builderState.duration,
        status: 'draft', // Will be updated when render completes
        voice_provider: builderState.voice.provider,
        voice_id: builderState.voice.id,
        background_music_id: builderState.backgroundMusic?.id,
        solfeggio_frequency: builderState.solfeggio?.frequency,
        binaural_band: builderState.binaural?.band,
      })
      .select()
      .single();

    if (trackError || !track) {
      console.error('Failed to create track:', trackError);
      throw new Error('Failed to create track');
    }

    // 4. Enqueue audio rendering job
    const { error: jobError } = await supabase
      .from('audio_job_queue')
      .insert({
        track_id: track.id,
        user_id: userId,
        status: 'pending',
        job_data: builderState, // Store full config for rendering
        priority: 10, // High priority for first-track
      });

    if (jobError) {
      console.error('Failed to enqueue job:', jobError);
    }

    // 5. Mark first-track discount as used (if it was used)
    if (firstTrackDiscount) {
      await supabase
        .from('profiles')
        .update({ first_track_discount_used: true })
        .eq('id', userId);
    }

    // 6. Create purchase record
    const { error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        user_id: userId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent,
        total_amount: session.amount_total,
        currency: session.currency,
        status: 'completed',
      });

    // 7. Grant track access
    await supabase
      .from('track_access')
      .insert({
        user_id: userId,
        track_id: track.id,
        access_type: 'owned', // They created it
        granted_at: new Date().toISOString(),
      });

    // 8. Send welcome/confirmation email
    // TODO: Implement email sending

    console.log('Successfully processed first-track conversion:', {
      userId,
      trackId: track.id,
      discountUsed: firstTrackDiscount,
    });
  }
}
```

### Step 10: Success Page & Library 🔧 NEEDS ENHANCEMENT
**Files:**
- `apps/web/src/app/api/checkout/success/route.ts`
- `apps/web/src/app/library/page.tsx`

#### Success Page Updates:
```typescript
// After fetching session
return NextResponse.json({
  items: [...],
  totalAmount: session.amount_total,
  currency: session.currency,
  redirectTo: '/library?new=true', // ✅ ADD: Tell frontend where to go
  trackId: track.id, // ✅ ADD: New track ID for highlighting
});
```

#### Library Page Updates:
```typescript
// Detect new track from URL
const searchParams = useSearchParams();
const isNewTrack = searchParams.get('new') === 'true';
const newTrackId = searchParams.get('trackId');

// Show banner for new tracks
{isNewTrack && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
    <h3 className="font-semibold text-green-900">🎉 Your track is being created!</h3>
    <p className="text-green-700">We're rendering your audio now. This usually takes 2-5 minutes.</p>
  </div>
)}

// Subscribe to real-time updates for rendering tracks
useEffect(() => {
  const subscription = supabase
    .channel('audio_jobs')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'audio_job_queue',
      filter: `user_id=eq.${user.id}`,
    }, (payload) => {
      // Update track status in UI
      fetchTracks(); // Refresh tracks
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [user]);
```

---

## Implementation Tasks

### Task 1: Fix Auth Modal ✅ PRIORITY
**File:** `apps/web/src/components/auth-modal.tsx`

**Changes:**
1. Add duplicate email detection in signup error handling
2. Auto-switch to login mode when email exists
3. Pre-fill email field after switch
4. Show helpful error message
5. Ensure `onAuthenticated` callback works correctly

**Testing:**
- Try signing up with existing email → Should auto-switch to login
- Complete login → Should trigger pricing check
- Try signing up with new email → Should create account and proceed

### Task 2: Fix Guest Builder Pricing Check ✅ PRIORITY
**File:** `apps/web/src/components/guest-builder.tsx`

**Changes:**
1. Move pricing check logic from `useEffect` to `handleAuthSuccess`
2. Add alert for users who already used discount
3. Pass correct price amount to checkout API
4. Pass `userId` and `firstTrackDiscount` flag to checkout

**Testing:**
- New user → Should see $0.99
- Existing user (eligible) → Should see $0.99
- Existing user (used discount) → Should see $2.99 with alert

### Task 3: Update Checkout API ✅ PRIORITY
**File:** `apps/web/src/app/api/checkout/guest-conversion/route.ts`

**Changes:**
1. Add `userId` to request schema
2. Add `firstTrackDiscount` to request schema
3. Add both to Stripe session metadata
4. Use dynamic `priceAmount` from request

**Testing:**
- Verify metadata includes user_id
- Verify metadata includes discount flag
- Check Stripe dashboard for correct metadata

### Task 4: Implement Webhook Handler ✅ CRITICAL
**File:** `apps/web/src/app/api/webhooks/stripe/route.ts`

**Changes:**
1. Detect `conversion_type === 'guest_to_user'`
2. Extract user_id from metadata
3. Reconstruct builder state from metadata
4. Create track record
5. Enqueue audio job
6. Mark first_track_discount_used
7. Create purchase record
8. Grant track access

**Testing:**
- Test with Stripe CLI webhook forwarding
- Verify track created with correct user_id
- Verify audio job enqueued
- Verify discount marked as used

### Task 5: Update Success Flow
**File:** `apps/web/src/app/api/checkout/success/route.ts`

**Changes:**
1. Return `redirectTo` with library URL
2. Include new track ID

**Testing:**
- After payment, verify redirect to library
- Verify trackId parameter present

### Task 6: Enhance Library Page
**File:** `apps/web/src/app/library/page.tsx`

**Changes:**
1. Detect `?new=true` parameter
2. Show "Track is rendering" banner
3. Set up Supabase Realtime subscription
4. Auto-refresh when job completes

**Testing:**
- After payment, verify banner shows
- Verify real-time updates work
- Verify banner disappears when complete

---

## Database Schema Requirements

### Tables Used:

#### `profiles`
```sql
- id (uuid, FK to auth.users)
- first_track_discount_used (boolean, default false)
- display_name (text)
- created_at (timestamp)
```

#### `tracks`
```sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- title (text)
- script (text)
- duration (integer, minutes)
- status (text: 'draft', 'published', 'archived')
- voice_provider (text)
- voice_id (text)
- background_music_id (text, nullable)
- solfeggio_frequency (integer, nullable)
- binaural_band (text, nullable)
- audio_url (text, nullable)
- created_at (timestamp)
```

#### `audio_job_queue`
```sql
- id (uuid, PK)
- track_id (uuid, FK to tracks)
- user_id (uuid, FK to profiles)
- status (text: 'pending', 'processing', 'completed', 'failed')
- progress (integer, 0-100)
- job_data (jsonb)
- priority (integer, default 0)
- created_at (timestamp)
- updated_at (timestamp)
```

#### `purchases`
```sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- stripe_checkout_session_id (text)
- stripe_payment_intent_id (text)
- total_amount (integer, cents)
- currency (text)
- status (text)
- created_at (timestamp)
```

#### `track_access`
```sql
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- track_id (uuid, FK to tracks)
- access_type (text: 'owned', 'purchased')
- granted_at (timestamp)
```

---

## Testing Scenarios

### Scenario 1: Brand New User
**Steps:**
1. Visit homepage
2. Build track (script, voice, duration)
3. Click "Create Your First Track"
4. See auth modal
5. Sign up with new email
6. Account created immediately
7. Pricing check shows $0.99
8. Proceed to Stripe
9. Complete payment
10. Webhook creates track and enqueues job
11. Redirect to library
12. See track in "rendering" state
13. Wait for completion
14. Play/download track

**Expected Results:**
- ✅ User account exists before payment
- ✅ Price is $0.99
- ✅ Track renders successfully
- ✅ `first_track_discount_used = true`

### Scenario 2: New User with Existing Email
**Steps:**
1. Build track
2. Click "Create Your First Track"
3. Try to sign up with email that exists
4. See error, auto-switch to login
5. Enter password
6. Successfully log in
7. Pricing check runs
   - IF never used discount: $0.99, proceed
   - IF used discount: $2.99, show alert, user confirms
8. Proceed to Stripe
9. Complete payment
10. See track in library

**Expected Results:**
- ✅ No dead end when email exists
- ✅ User logs in successfully
- ✅ Correct pricing applied
- ✅ Track created regardless of price

### Scenario 3: Returning User (Eligible)
**Steps:**
1. Build track
2. Click "Create Your First Track"
3. Already logged in OR log in via modal
4. Pricing check: $0.99 (discount available)
5. Proceed to Stripe
6. Complete payment
7. See track in library

**Expected Results:**
- ✅ Price is $0.99
- ✅ After payment: `first_track_discount_used = true`
- ✅ Next purchase will be $2.99

### Scenario 4: Returning User (Used Discount)
**Steps:**
1. Build track
2. Click "Create Your First Track"
3. Log in
4. Pricing check: $2.99
5. See alert: "You've already used your first-track discount..."
6. User confirms, proceeds
7. Complete payment at $2.99
8. See track in library

**Expected Results:**
- ✅ Alert shown about regular pricing
- ✅ User can still proceed
- ✅ Payment is $2.99
- ✅ Track created normally

---

## Key Technical Points

### Stripe Session Metadata Structure
```typescript
{
  // User identification
  user_id: "uuid-string",

  // Conversion tracking
  conversion_type: "guest_to_user",
  first_track_discount_used: "true" | "false",

  // Track configuration
  voice_provider: "openai" | "elevenlabs",
  voice_id: "alloy" | "rachel" | etc,
  voice_name: "display name",
  duration: "5",

  // Script (chunked due to 500 char limit per field)
  script_chunk_0: "first 400 chars...",
  script_chunk_1: "next 400 chars...",
  script_chunks_count: "2",

  // Optional features
  background_music_id: "calm-waters",
  background_music_name: "Calm Waters",
  solfeggio_frequency: "528",
  binaural_band: "alpha",

  // Pricing
  total_amount: "299", // cents
}
```

### Helper Function: Reconstruct Script
```typescript
function reconstructScript(metadata: Record<string, string>): string {
  const chunkCount = parseInt(metadata.script_chunks_count || '0');
  const chunks: string[] = [];

  for (let i = 0; i < chunkCount; i++) {
    const chunk = metadata[`script_chunk_${i}`];
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks.join('');
}
```

---

## Current State Summary

### ✅ What's Working:
1. Guest builder UI and state management
2. Auth modal (signup + login)
3. Middleware authentication checks
4. Library page UI
5. Library API (fetches tracks correctly)
6. Pricing API (checks eligibility correctly)
7. Checkout API (creates Stripe sessions)

### ❌ What Needs Fixing:
1. Auth modal: No duplicate email detection
2. Guest builder: Pricing check happens too early (before auth)
3. Checkout API: Doesn't receive or pass user_id
4. Webhook: Doesn't handle guest conversion flow
5. Success flow: Doesn't redirect to library
6. Library: No "new track" banner or real-time updates

### 🎯 Priority Order:
1. **Task 1-2:** Fix auth flow and pricing check (blocks everything)
2. **Task 3-4:** Fix checkout and webhook (enables track creation)
3. **Task 5-6:** Polish success flow and library UX

---

## Notes for Implementation

1. **Test with Stripe CLI:** Use `stripe listen --forward-to localhost:3000/api/webhooks/stripe` for local webhook testing
2. **Check RLS Policies:** Ensure users can only see their own tracks
3. **Error Handling:** Add comprehensive error logging in webhook handler
4. **Email Notifications:** Plan for future email system integration
5. **Analytics:** Track conversion funnel (build → auth → payment → complete)

---

## Success Criteria

When implementation is complete:

- ✅ User cannot reach payment without being authenticated
- ✅ Pricing check happens AFTER authentication
- ✅ Duplicate email gracefully switches to login
- ✅ Users who already used discount see alert but can proceed
- ✅ Payment creates track and starts rendering
- ✅ Library shows track with real-time status updates
- ✅ All 4 test scenarios pass completely

---

**End of Implementation Guide**