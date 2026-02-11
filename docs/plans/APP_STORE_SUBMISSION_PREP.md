# App Store & Google Play Submission Preparation

## Status
- **TestFlight Build 5**: Submitted and working (2026-02-11)
- **Google Play**: Not yet started
- **Next Step**: Address requirements below before first public submission

---

## Required for Apple App Store Submission

### 1. Delete Account (REQUIRED - Guideline 5.1.1(v))
- Apple requires **all apps with account creation/login** to provide in-app account deletion
- Even though signup happens on web, the app has login = account-enabled
- **Implementation**: Add "Delete Account" button in settings/profile screen
- Must actually delete user data (Supabase auth user, profile, tracks, purchases, cloned voices, storage files)
- Should show confirmation dialog explaining what will be deleted
- Consider 30-day grace period before permanent deletion

### 2. Privacy Policy (REQUIRED)
- Must be accessible from within the app AND on the App Store listing
- Must cover: data collection, usage, sharing, retention, deletion
- Needs to mention: Supabase (auth/storage), Stripe (payments), ElevenLabs (voice cloning), analytics
- **Action**: Create privacy policy page on web app, link from mobile app settings

### 3. Terms of Service
- Link from app settings and App Store listing
- Cover: acceptable use, payment terms, voice cloning consent, content ownership
- **Action**: Create terms page on web app, link from mobile app settings

### 4. App Store Metadata
- Screenshots (6.7" and 5.5" required, 6.5" recommended)
- App description (up to 4000 chars)
- Keywords (up to 100 chars)
- Support URL
- Marketing URL (optional)
- App category: Health & Fitness or Lifestyle
- Age rating questionnaire
- Copyright info

### 5. App Privacy Nutrition Labels
- Must declare all data types collected:
  - Contact Info (email for auth)
  - Identifiers (user ID)
  - Purchases (Stripe payment history)
  - Usage Data (playback analytics)
  - Audio Data (voice cloning samples)
- Declare purposes: App Functionality, Analytics

### 6. Export Compliance
- Already set `ITSAppUsesNonExemptEncryption: false` in app.json
- Supabase uses HTTPS (standard encryption) - no export compliance issues

---

## Required for Google Play Submission

### 1. Delete Account (REQUIRED - User Data Policy)
- Same as Apple - must offer account deletion
- Google additionally requires a web-based deletion option

### 2. Privacy Policy (REQUIRED)
- Same policy as Apple, linked in Play Console

### 3. Data Safety Section
- Similar to Apple's nutrition labels
- Declare all data collected, shared, security practices

### 4. Store Listing
- Feature graphic (1024x500)
- Screenshots (min 2, up to 8 per device type)
- Short description (80 chars)
- Full description (4000 chars)

### 5. Content Rating (IARC)
- Complete questionnaire in Play Console
- Meditation/wellness app should get "Everyone" rating

### 6. Target Audience
- Declare target age group (must be 13+ if using analytics)

---

## Implementation Priority

### Phase 1 (Before First Submission)
1. [ ] Delete account flow (API route + mobile UI)
2. [ ] Privacy policy page (web)
3. [ ] Terms of service page (web)
4. [ ] Settings screen with links to privacy/terms + delete account
5. [ ] App Store screenshots
6. [ ] App Store metadata (description, keywords, etc.)

### Phase 2 (Post-Launch Polish)
- [ ] Lock screen / Now Playing controls (expo-audio `setActiveForLockScreen()`)
- [ ] Push notifications for render completion
- [ ] Offline download management UI
- [ ] Deep linking from web to mobile
- [ ] Google Play submission

---

## Technical Notes

### expo-audio Lock Screen Controls
The expo-audio package supports lock screen controls via `player.setActiveForLockScreen()`:
```typescript
player.setActiveForLockScreen(true, {
  title: track.title,
  artist: track.artist || 'MindScript',
  album: track.album,
  artwork: track.artwork,
});
```
This should be wired up in `loadTrack()` in playerStore.ts when we're ready.

### Delete Account API Route
```
DELETE /api/account
- Requires authenticated user
- Deletes: auth user, profile, tracks, purchases, cloned_voices, voice_consent_records
- Removes storage files: voice-samples, track-artwork, audio-renders
- Cancels any active Stripe subscriptions
- Returns confirmation
```

### Current Build Info
- EAS Project ID: b21c223f-bb45-4704-9252-73ccf4a20034
- Bundle ID: com.mindscript.app
- App Store ID: 6758994576
- Current buildNumber: 5
- Apple Team: TCD69QYQXS
