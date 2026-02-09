# Mobile App Plan

## Phase 1: Library & Player (Reader App)

### Overview
A mobile app for existing MindScript users to browse their library and listen to tracks with a native audio experience. No purchasing, no creation — just playback.

### Core Features
- **Auth** — Supabase auth (same account as web)
- **Library view** — All tracks the user has purchased/created
- **Native audio player** — Background playback, lock screen controls, Media Session API
- **Offline caching** — Download tracks for offline listening (LRU cache, configurable storage limit)
- **Push notifications** — "Your track is ready" when a render completes
- **Deep links** — Web can send users to the app for playback

### Explicitly Out of Scope (Phase 1)
- No builder/creation flow
- No purchasing/checkout
- No mention of or link to web purchasing (Apple's rules)
- No Stripe, no IAP, no RevenueCat

### Tech Stack
- Expo Router (already scaffolded in `apps/mobile`)
- `expo-av` or `react-native-track-player` for audio
- Supabase JS client for auth + data
- Expo notifications for push
- AsyncStorage / expo-file-system for offline cache

### Architectural Decisions
- Share types/schemas from `packages/schemas`
- Audio playback logic stays in the mobile app (not shared with web — different APIs)
- Offline-first pattern: cache track metadata + audio files, sync on connectivity
- No shared UI package dependency (React Native components differ from web)

### Key Screens
1. **Login/Signup** — Supabase auth, same credentials as web
2. **Library** — Grid/list of user's tracks with artwork, title, duration
3. **Now Playing** — Full player with controls, progress, background music info
4. **Mini Player** — Persistent bottom bar during navigation
5. **Settings** — Account, offline storage management, notification preferences

### Audio Playback Requirements
- Background playback (app minimized / screen locked)
- Lock screen & notification controls (play/pause/skip)
- Queue management (play next, play later)
- Resume position on app reopen
- Streaming with progressive download
- Offline playback from cache

---

## Phase 2: Full Creation (Future — IAP)

### Overview
Add the ability to create and purchase tracks directly in the mobile app. Only planned after Phase 1 validates demand.

### What It Adds
- Lite builder flow (possibly template-based, simpler than web)
- IAP via RevenueCat for track purchases
- RevenueCat webhook → backend → same render pipeline as web
- Ledger reconciliation between Stripe (web) and RevenueCat (mobile) purchases
- Price parity handling between web and mobile

### Pricing Considerations
- Apple/Google take 15-30% on IAP
- Apple allows custom pricing (not limited to $0.99 increments since 2022)
- Bundled line items (track + background) would be a single IAP consumable for the total
- RevenueCat abstracts cross-platform IAP management
- Need unified purchase ledger: `purchases` table tracks source (stripe | revenucat)

### Decision Criteria for Phase 2
- Phase 1 adoption rate and usage patterns
- User requests for mobile creation
- Revenue impact analysis of Apple/Google cut
- Complexity assessment of lite builder on mobile

---

## Timeline & Dependencies
- Phase 1 is independent of F&F program — can be built in parallel
- Phase 1 depends on: stable Supabase schema, tracks table, audio storage URLs
- Phase 2 depends on: Phase 1 shipped + demand signal + RevenueCat integration planning
